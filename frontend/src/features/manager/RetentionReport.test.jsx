// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import RetentionReport from './RetentionReport';
import {Reports} from './ManagerApp';
import {adminApi} from '../../api/manager-api';
vi.mock('../../api/manager-api',async original=>({...await original(),adminApi:vi.fn()}));
const report={totalCustomers:6,purchasingCustomers:5,repeatCustomers:3,repeatRate:60,completedValue:5001200,averageCompletedValuePerBuyer:1000240,dormantCustomers:3,distribution:[{stage:'NO_PURCHASE',count:1,percentage:16.67},{stage:'FIRST_PURCHASE',count:1,percentage:16.67},{stage:'RETURNING',count:2,percentage:33.33},{stage:'LOYAL',count:2,percentage:33.33}],thresholds:{loyalOrders:5,loyalValue:5000000,dormantDays:30,timezone:'Asia/Ho_Chi_Minh'},updatedAt:'2026-10-15T17:01:00Z'};
const flush=async()=>{await act(async()=>{});};
beforeEach(()=>{vi.useFakeTimers();vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');adminApi.mockReset();adminApi.mockResolvedValue(report);window.history.replaceState({},'','/manager/reports?tab=retention');});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('shows definitions and exact buyer/repeat/dormant/stage drilldowns',async()=>{
 const go=vi.fn();render(<RetentionReport go={go}/>);await flush();
 expect(screen.getByText('60,00%')).toBeTruthy();expect(screen.getByText(/chưa phải phân tích/)).toBeTruthy();
 for(const [label,url] of [['Xem tổng khách hàng','users'],['Xem khách đã mua','users?minCompletedOrders=1'],['Xem khách mua lại','users?minCompletedOrders=2'],['Xem lâu chưa mua lại','users?dormant=true'],['Xem nhóm Khách thân thiết','users?stage=LOYAL']]){fireEvent.click(screen.getByRole('button',{name:label,exact:true}));expect(go).toHaveBeenLastCalledWith(url);}
});
it('links the resolved support count to the matching ticket filter',async()=>{
 adminApi.mockResolvedValue({...report,resolvedSupportTickets:7});const go=vi.fn();render(<RetentionReport go={go}/>);await flush();
 fireEvent.click(screen.getByRole('button',{name:'7',exact:true}));expect(go).toHaveBeenCalledWith('support-tickets?status=RESOLVED');
});
it('polls, retains old numbers on failure, retries, pauses hidden tabs and cleans up',async()=>{
 const view=render(<RetentionReport go={vi.fn()}/>);await flush();expect(adminApi).toHaveBeenCalledTimes(1);
 adminApi.mockRejectedValueOnce(new Error('Offline'));await act(async()=>vi.advanceTimersByTimeAsync(5000));
 expect(screen.getByRole('alert').textContent).toContain('số liệu gần nhất');expect(screen.getByText('60,00%')).toBeTruthy();
 fireEvent.click(screen.getByText('Thử lại'));await flush();expect(screen.queryByRole('alert')).toBeNull();
 vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(adminApi).toHaveBeenCalledTimes(3);
 view.unmount();await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(adminApi).toHaveBeenCalledTimes(3);
});
it('does not overlap slow polling and ignores a response after leaving',async()=>{
 let resolve;adminApi.mockReturnValue(new Promise(r=>{resolve=r;}));const view=render(<RetentionReport go={vi.fn()}/>);
 await act(async()=>vi.advanceTimersByTimeAsync(15000));expect(adminApi).toHaveBeenCalledTimes(1);view.unmount();await act(async()=>resolve(report));
});
it('supports direct report URLs, switching tabs and popstate with only the active report',async()=>{
 render(<Reports go={vi.fn()}/>);await flush();expect(screen.getByRole('button',{name:'Giữ chân khách hàng',exact:true}).getAttribute('aria-pressed')).toBe('true');
 adminApi.mockResolvedValue({});fireEvent.click(screen.getByRole('button',{name:'Khách hàng',exact:true}));await flush();expect(window.location.search).toBe('');
 const calls=adminApi.mock.calls.filter(([url])=>url.includes('/retention')).length;
 await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(adminApi.mock.calls.filter(([url])=>url.includes('/retention')).length).toBe(calls);
 adminApi.mockResolvedValue(report);window.history.replaceState({},'','/manager/reports?tab=retention');act(()=>window.dispatchEvent(new PopStateEvent('popstate')));await flush();expect(screen.getByText('60,00%')).toBeTruthy();
});
it('handles initial errors and an empty report without invalid percentages',async()=>{
 adminApi.mockRejectedValueOnce(new Error('Offline'));render(<RetentionReport go={vi.fn()}/>);await flush();expect(screen.getByRole('alert').textContent).toContain('Offline');
 adminApi.mockResolvedValue({...report,totalCustomers:0,purchasingCustomers:0,repeatCustomers:0,repeatRate:0,completedValue:0,averageCompletedValuePerBuyer:0,dormantCustomers:0,distribution:report.distribution.map(g=>({...g,count:0,percentage:0}))});fireEvent.click(screen.getByText('Thử lại'));await flush();expect(screen.getByText('Chưa có khách hàng để thống kê.')).toBeTruthy();expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
});
