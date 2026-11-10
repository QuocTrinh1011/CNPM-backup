// @vitest-environment jsdom
import React from 'react';
import {act,render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import CareOutcomes from './CareOutcomes';
import CareDashboard from './CareDashboard';
import ManagerApp from './ManagerApp';
import {adminApi,adminRefreshSession} from './api/manager-api';
vi.mock('./api/manager-api',async original=>({...await original(),adminApi:vi.fn(),adminRefreshSession:vi.fn()}));
const counts={completed:6,recorded:3,unrecorded:3,contacted:1,unreachable:1,resolved:1,needsFollowUp:0,resolvedRate:33.33};
const data={counts,distribution:['CONTACTED','UNREACHABLE','RESOLVED','NEEDS_FOLLOW_UP'].map((outcome,i)=>({outcome,count:i===3?0:1,percentage:i===3?0:33.33})),staff:[{id:4,name:'Quản lý A',active:false,counts}],asOf:'2026-10-15T10:00:00Z'};
const overview={counts:{total:0,todo:0,inProgress:0,completed:0,overdue:0},staff:[],dormantWithoutOpenTask:0,asOf:data.asOf};
const flush=async()=>{await act(async()=>{await import('./CareOutcomes');await import('./CareDashboard');});};
beforeEach(()=>{vi.useFakeTimers();vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');adminApi.mockReset();adminApi.mockImplementation(async url=>url.includes('/outcomes')?data:overview);adminRefreshSession.mockResolvedValue({manager:{fullName:'Manager'}});window.history.replaceState({},'','/manager/care-dashboard?tab=outcomes');});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('shows known-only rate, distribution, inactive staff and matching completion-date drilldowns',async()=>{
 const go=vi.fn();render(<CareOutcomes go={go} location="care-dashboard?tab=outcomes&from=2026-10-01&to=2026-10-15&assigneeId=4"/>);await flush();expect(screen.getAllByText('33,33%').length).toBeGreaterThan(0);expect(screen.getByText('Không còn hoạt động')).toBeTruthy();
 for(const [label,outcome] of [['Xem công việc hoàn thành',null],['Xem đã ghi nhận kết quả','RECORDED'],['Xem chưa ghi nhận kết quả','UNRECORDED'],['Xem nhóm Đã giải quyết','RESOLVED']]){
  fireEvent.click(screen.getByRole('button',{name:label,exact:true}));const params=new URLSearchParams(go.mock.calls.at(-1)[0].split('?')[1]);expect(params.get('status')).toBe('COMPLETED');expect(params.get('completedFrom')).toBe('2026-10-01');expect(params.get('completedTo')).toBe('2026-10-15');expect(params.get('from')).toBeNull();expect(params.get('outcome')).toBe(outcome);expect(params.get('assigneeId')).toBe('4');
 }
 fireEvent.click(screen.getByRole('button',{name:'Xem chưa ghi nhận kết quả của Quản lý A'}));expect(go.mock.calls.at(-1)[0]).toContain('assigneeId=4');
});
it('keeps the active tab in filter URLs and drops dates when switching tabs',async()=>{
 const go=vi.fn();const view=render(<CareDashboard go={go} location="care-dashboard?tab=outcomes&from=2026-10-01&to=2026-10-15&assigneeId=4"/>);await flush();
 expect(screen.getByRole('button',{name:'Kết quả chăm sóc',exact:true}).getAttribute('aria-pressed')).toBe('true');fireEvent.change(screen.getByLabelText('Hoàn thành từ ngày'),{target:{value:'2026-10-02'}});expect(go.mock.calls.at(-1)[0]).toContain('tab=outcomes');
 fireEvent.click(screen.getByRole('button',{name:'Tổng quan',exact:true}));expect(go).toHaveBeenLastCalledWith('care-dashboard?tab=overview&assigneeId=4');
 view.rerender(<CareDashboard go={go} location="care-dashboard?tab=overview&assigneeId=4"/>);await flush();const count=adminApi.mock.calls.filter(([url])=>url.includes('/outcomes')).length;await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(adminApi.mock.calls.filter(([url])=>url.includes('/outcomes'))).toHaveLength(count);expect(adminApi.mock.calls.some(([url])=>url.includes('/dormant'))).toBe(false);
});
it('polls without overlap, retains data on error, retries and cleans up',async()=>{
 const view=render(<CareOutcomes go={vi.fn()}/>);await flush();adminApi.mockRejectedValueOnce(new Error('Offline'));await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(screen.getByRole('alert').textContent).toContain('số liệu gần nhất');expect(screen.getAllByText('33,33%').length).toBeGreaterThan(0);fireEvent.click(screen.getByText('Thử lại'));await flush();expect(screen.queryByRole('alert')).toBeNull();
 let resolve;adminApi.mockImplementation(()=>new Promise(r=>{resolve=r;}));await act(async()=>vi.advanceTimersByTimeAsync(5000));const calls=adminApi.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(15000));expect(adminApi).toHaveBeenCalledTimes(calls);view.unmount();await act(async()=>resolve(data));await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(adminApi).toHaveBeenCalledTimes(calls);
});
it('supports direct route and back/forward with no background polling of inactive reports',async()=>{
 render(<ManagerApp/>);await flush();expect(screen.getByRole('button',{name:'Kết quả chăm sóc',exact:true}).getAttribute('aria-pressed')).toBe('true');
 act(()=>{window.history.replaceState({},'','/manager/care-dashboard?tab=overview');window.dispatchEvent(new PopStateEvent('popstate'));});await flush();expect(within(screen.getByRole('navigation',{name:'Báo cáo chăm sóc'})).getByRole('button',{name:'Tổng quan',exact:true}).getAttribute('aria-pressed')).toBe('true');
 const calls=adminApi.mock.calls.filter(([url])=>url.includes('/outcomes')).length;await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(adminApi.mock.calls.filter(([url])=>url.includes('/outcomes'))).toHaveLength(calls);
 act(()=>{window.history.replaceState({},'','/manager/care-dashboard?tab=outcomes');window.dispatchEvent(new PopStateEvent('popstate'));});await flush();expect(screen.getByText('Phân bố kết quả đã ghi nhận')).toBeTruthy();
});
it('handles initial failure and empty/unknown-only reports without dividing by zero',async()=>{
 adminApi.mockRejectedValueOnce(new Error('Offline'));render(<CareOutcomes go={vi.fn()}/>);await flush();expect(screen.getByRole('alert').textContent).toContain('Offline');
 adminApi.mockResolvedValue({...data,counts:{...counts,completed:0,recorded:0,unrecorded:0,resolvedRate:0},distribution:data.distribution.map(g=>({...g,count:0,percentage:0})),staff:[]});fireEvent.click(screen.getByText('Thử lại'));await flush();expect(screen.getByText('Chưa có công việc hoàn thành phù hợp.')).toBeTruthy();expect(screen.getByText('0,00%')).toBeTruthy();expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
});
