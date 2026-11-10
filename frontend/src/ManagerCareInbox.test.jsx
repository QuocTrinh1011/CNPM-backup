// @vitest-environment jsdom
import React from 'react';
import {act,render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import ManagerMyTasks,{CareTaskDetail,MyTaskSummary} from './features/manager/ManagerMyTasks';
import ManagerNotificationBell from './features/manager/ManagerNotificationBell';
import ManagerApp from './ManagerApp';
import {adminApi,adminRefreshSession} from './api/manager-api';
vi.mock('./api/manager-api',async original=>({...await original(),adminApi:vi.fn(),adminRefreshSession:vi.fn()}));
const task={id:42,customerId:2,customerName:'Khách A',assigneeId:3,assigneeName:'Quản lý',assigneeActive:true,title:'Liên hệ đơn đổi trả',description:'Nội dung chăm sóc',status:'TODO',dueAt:'2026-10-15T05:00:00Z',overdue:true,version:0};
const page={content:[task],totalElements:11,totalPages:2,page:0,size:10};
const summary={counts:{OPEN:11,TODAY:2,UPCOMING:3,OVERDUE:4,FOLLOW_UP:1}};
const item={id:8,title:'Công việc đã quá hạn',content:'Liên hệ đơn đổi trả',type:'CARE_OVERDUE',taskId:42,applicable:true,state:'ACTIVE',createdAt:'2026-10-15T05:00:00Z'};
const result={page:{...page,content:[item]},unreadCount:1};
const flush=async()=>act(async()=>{await Promise.resolve();});
const calls=part=>adminApi.mock.calls.filter(([url])=>url.includes(part));
beforeEach(()=>{vi.useFakeTimers();vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');adminApi.mockReset();adminApi.mockImplementation(async(url,opts)=>{if(opts?.method==='PATCH')return null;if(url.includes('/notifications/summary'))return {unreadCount:1};if(url.includes('/notifications?'))return result;if(url.includes('/my-tasks/summary'))return summary;if(url.includes('/my-tasks?'))return page;if(url.includes('/care/tasks/'))return task;if(url.includes('/care/staff'))return {content:[{id:3,fullName:'Quản lý'}],totalPages:1};return {content:[],totalPages:1};});adminRefreshSession.mockResolvedValue({manager:{id:3,fullName:'Quản lý'}});window.history.replaceState({},'','/manager/my-tasks');});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('keeps personal filters/search/page in URLs and opens an exact task',async()=>{
 const go=vi.fn();render(<ManagerMyTasks go={go} location="/manager/my-tasks?group=OVERDUE&q=đổi&page=1"/>);await flush();expect(calls('/my-tasks?')[0][0]).toContain('group=OVERDUE');expect(calls('/my-tasks?')[0][0]).toContain('page=1');fireEvent.change(screen.getByLabelText('Nhóm việc của tôi'),{target:{value:'TODAY'}});expect(go.mock.calls.at(-1)[0]).toContain('page=0');fireEvent.click(screen.getByText('Chi tiết / xử lý'));expect(go.mock.calls.at(-1)[0]).toContain('taskId=42');expect(go.mock.calls.at(-1)[0]).toContain('page=1');
});
it('loads exact task independently of the list and preserves failed form edits',async()=>{
 render(<CareTaskDetail taskId="42" onClose={vi.fn()}/>);await flush();expect(calls('/care/tasks/42')).toHaveLength(1);expect(screen.getByText('Khách hàng: Khách A')).toBeTruthy();fireEvent.click(screen.getByText('Xử lý công việc'));await flush();fireEvent.change(screen.getByLabelText('Tiêu đề công việc'),{target:{value:'Bản nháp'}});adminApi.mockImplementation(async(url,options)=>{if(options?.method==='PATCH')throw new Error('Offline');return {content:[],totalPages:1};});fireEvent.submit(screen.getByRole('form',{name:'Sửa công việc chăm sóc'}));await flush();expect(screen.getByRole('alert').textContent).toContain('Offline');expect(screen.getByLabelText('Tiêu đề công việc').value).toBe('Bản nháp');
});
it('only polls unread count while closed and marks notification before navigating',async()=>{
 const go=vi.fn();render(<ManagerNotificationBell go={go} location="/manager"/>);await flush();expect(calls('/notifications?')).toHaveLength(0);await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(calls('/notifications/summary')).toHaveLength(2);fireEvent.click(screen.getByRole('button',{name:'Thông báo chăm sóc: 1 chưa đọc'}));await flush();expect(calls('/notifications?')).toHaveLength(1);fireEvent.click(screen.getByText(item.title));await flush();expect(adminApi).toHaveBeenCalledWith('/api/manager/notifications/8/read',{method:'PATCH'});expect(go).toHaveBeenCalledWith('care?taskId=42');const count=calls('/notifications?').length;await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(calls('/notifications?')).toHaveLength(count);
});
it('notification pagination hides stale data, keeps history labels and supports Escape',async()=>{
 const view=render(<ManagerNotificationBell go={vi.fn()} location="/manager"/>);await flush();fireEvent.click(screen.getByRole('button',{name:'Thông báo chăm sóc: 1 chưa đọc'}));await flush();let resolve;adminApi.mockImplementation(async url=>url.includes('page=1')?new Promise(r=>{resolve=r;}):{unreadCount:1});fireEvent.click(screen.getByText('Sau'));await flush();expect(screen.queryByText(item.title)).toBeNull();expect(screen.getByRole('status').textContent).toContain('Đang tải');await act(async()=>resolve({page:{...result.page,content:[{...item,state:'COMPLETED',applicable:false}]}}));expect(screen.getByText(/Đã hoàn thành/)).toBeTruthy();fireEvent.keyDown(document,{key:'Escape'});expect(screen.queryByRole('region',{name:'Thông báo chăm sóc'})).toBeNull();view.unmount();const count=adminApi.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(15000));expect(adminApi).toHaveBeenCalledTimes(count);
});
it('retains summary on network errors and retries without clearing counts',async()=>{
 render(<MyTaskSummary go={vi.fn()}/>);await flush();adminApi.mockRejectedValueOnce(new Error('Offline'));await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(screen.getByRole('alert').textContent).toContain('dữ liệu gần nhất');expect(screen.getByText('Quá hạn: 4')).toBeTruthy();fireEvent.click(screen.getByText('Thử lại'));await flush();expect(screen.queryByRole('alert')).toBeNull();
});
it('opens direct my-tasks URL and exact detail, restores filters on back-forward',async()=>{
 window.history.replaceState({},'','/manager/my-tasks?group=OVERDUE&page=1&taskId=42');render(<ManagerApp/>);await flush();expect(screen.getByRole('heading',{name:'Công việc #42'})).toBeTruthy();expect(screen.getByLabelText('Nhóm việc của tôi').value).toBe('OVERDUE');act(()=>{window.history.replaceState({},'','/manager/my-tasks?group=UPCOMING');window.dispatchEvent(new PopStateEvent('popstate'));});await flush();expect(screen.queryByRole('heading',{name:'Công việc #42'})).toBeNull();expect(screen.getByLabelText('Nhóm việc của tôi').value).toBe('UPCOMING');expect(within(screen.getByRole('navigation',{name:'Chức năng quản lý'})).queryByText('Việc của tôi')).toBeTruthy();
});
it('does not navigate from a late read response after the user changed pages and blocks repeated sends',async()=>{
 const go=vi.fn();const view=render(<ManagerNotificationBell go={go} location="/manager"/>);await flush();fireEvent.click(screen.getByRole('button',{name:'Thông báo chăm sóc: 1 chưa đọc'}));await flush();let resolve;
 adminApi.mockImplementation((url,opts)=>opts?.method==='PATCH'?new Promise(r=>{resolve=r;}):Promise.resolve({unreadCount:0}));const button=screen.getByText(item.title);fireEvent.click(button);fireEvent.click(button);expect(adminApi.mock.calls.filter(([,opts])=>opts?.method==='PATCH')).toHaveLength(1);
 view.rerender(<ManagerNotificationBell go={go} location="/manager/reports"/>);await act(async()=>resolve(null));expect(go).not.toHaveBeenCalled();expect(screen.queryByText(item.title)).toBeNull();
});
it('does not overlap slow notification polls, pauses hidden tabs and reloads on return',async()=>{
 let visibility='visible';vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility);render(<ManagerNotificationBell go={vi.fn()} location="/manager"/>);await flush();let resolve;
 adminApi.mockImplementation(()=>new Promise(r=>{resolve=r;}));await act(async()=>vi.advanceTimersByTimeAsync(5000));const count=adminApi.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(15000));expect(adminApi).toHaveBeenCalledTimes(count);await act(async()=>resolve({unreadCount:2}));
 visibility='hidden';act(()=>document.dispatchEvent(new Event('visibilitychange')));await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(adminApi).toHaveBeenCalledTimes(count);visibility='visible';act(()=>document.dispatchEvent(new Event('visibilitychange')));await flush();expect(adminApi).toHaveBeenCalledTimes(count+1);
});
it('opens support notifications using ticketId rather than treating them as care tasks',async()=>{
 const base=adminApi.getMockImplementation();adminApi.mockImplementation(async(url,options)=>url.includes('/notifications?')?{...result,page:{...result.page,content:[{...item,ticketId:71,taskId:null}]}}:base(url,options));const go=vi.fn();render(<ManagerNotificationBell go={go} location="/manager"/>);await flush();fireEvent.click(screen.getByRole('button',{name:'Thông báo chăm sóc: 1 chưa đọc'}));await flush();fireEvent.click(screen.getByText(item.title));await flush();expect(go).toHaveBeenCalledWith('support-tickets?id=71');
});
it('completes from exact detail then schedules the next call without losing the parent or its filters',async()=>{
 const onOpenTask=vi.fn();let current={...task,sourceType:'RETURN_ORDER',sourceId:9};
 adminApi.mockImplementation(async(url,options)=>{
  if(options?.method==='PATCH'){current={...current,...options.body};return current;}
  if(options?.method==='POST'){current={...current,followUpTaskId:77};return {...task,id:77,parentTaskId:42};}
  if(url.includes('/care/staff'))return {content:[{id:3,fullName:'Quản lý'}],totalPages:1};return current;
 });
 render(<CareTaskDetail taskId="42" onClose={vi.fn()} onOpenTask={onOpenTask}/>);await flush();fireEvent.click(screen.getByText('Xử lý công việc'));await flush();fireEvent.change(screen.getByLabelText('Trạng thái công việc'),{target:{value:'COMPLETED'}});fireEvent.change(screen.getByLabelText('Kết quả chăm sóc'),{target:{value:'NEEDS_FOLLOW_UP'}});fireEvent.click(screen.getByText('Lưu công việc'));await flush();expect(screen.getByText('Hẹn chăm sóc lại')).toBeTruthy();
 fireEvent.click(screen.getByText('Hẹn chăm sóc lại'));await flush();expect(screen.getByRole('form',{name:'Hẹn chăm sóc lại'})).toBeTruthy();fireEvent.change(screen.getByLabelText('Hạn xử lý'),{target:{value:'2030-01-02T10:30'}});fireEvent.click(screen.getByText('Lưu công việc'));await flush();
 expect(adminApi.mock.calls.filter(([,opts])=>opts?.method==='PATCH')).toHaveLength(1);const follow=adminApi.mock.calls.find(([url])=>url.endsWith('/follow-up'));expect(follow[0]).toBe('/api/manager/care/tasks/42/follow-up');expect(follow[1].body.dueAt).toBe('2030-01-02T03:30:00.000Z');expect(screen.getByRole('heading',{name:'Công việc #42'})).toBeTruthy();expect(screen.queryByText('Hẹn chăm sóc lại')).toBeNull();fireEvent.click(screen.getByText('Xem công việc #77'));expect(onOpenTask).toHaveBeenCalledWith(77);
});
