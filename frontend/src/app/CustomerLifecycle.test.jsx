// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,afterEach,it,vi,expect} from 'vitest';
import ManagerApp from './ManagerApp';
import CustomerLifecycle from '../features/manager/CustomerLifecycle';
import {adminApi,adminRefreshSession} from '../api/manager-api';
vi.mock('../api/manager-api',async original=>({...await original(),adminApi:vi.fn(),adminRefreshSession:vi.fn()}));
const user={id:7,fullName:'Khách thân thiết A',email:'a@test.vn',locked:true,completedOrders:5,completedValue:5000000,lastCompletedOrderAt:'2026-09-01T00:00:00Z',segmentation:{stage:'LOYAL',dormant:true,daysSinceLastPurchase:35}};
const page={content:[user],totalElements:25,totalPages:3};
const flush=async()=>act(async()=>{await import('../features/manager/CustomerProfile');await vi.advanceTimersByTimeAsync(0);});
beforeEach(()=>{
 vi.useFakeTimers();vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 adminRefreshSession.mockResolvedValue({manager:{fullName:'Manager'}});adminApi.mockReset();adminApi.mockResolvedValue(page);
 window.history.replaceState({},'','/manager/users?q=A&page=2');
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('shows separate lifecycle, dormancy and account status',()=>{
 render(<CustomerLifecycle segment={user.segmentation}/>);expect(screen.getByText('Khách thân thiết')).toBeTruthy();expect(screen.getByText('Lâu chưa mua lại')).toBeTruthy();expect(screen.getByText(/35 ngày/)).toBeTruthy();
});
it('restores a specific survey from URL, changes its answer filter and clears the survey ID',async()=>{
 window.history.replaceState({},'','/manager/users?page=2&surveyId=77&surveyed=false');
 adminApi.mockImplementation(async url=>url.includes('/filter-options')?{options:{content:[],totalPages:1},selected:{id:77,title:'Survey history',deleted:true}}:page);
 render(<ManagerApp/>);await flush();
 expect(screen.getByLabelText('Khảo sát cụ thể').value).toBe('77');
 expect(screen.getByRole('option',{name:'Chưa trả lời khảo sát đã chọn'})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Tham gia khảo sát'),{target:{value:'true'}});await flush();
 expect(window.location.search).toContain('page=0');expect(adminApi.mock.calls.some(([url])=>url.includes('/users?')&&url.includes('surveyId=77')&&url.includes('surveyed=true'))).toBe(true);
 fireEvent.click(screen.getByText('Xóa bộ lọc phân nhóm'));await flush();expect(new URLSearchParams(window.location.search).has('surveyId')).toBe(false);
});
it('persists rating and survey filters in URLs, sends them to the API and clears them',async()=>{
 render(<ManagerApp/>);await flush();
 fireEvent.change(screen.getByLabelText('Điểm đánh giá tối thiểu'),{target:{value:'3.5'}});await flush();
 fireEvent.change(screen.getByLabelText('Tham gia khảo sát'),{target:{value:'true'}});await flush();
 expect(new URLSearchParams(window.location.search).get('minRating')).toBe('3.5');
 expect(new URLSearchParams(window.location.search).get('page')).toBe('0');
 expect(adminApi.mock.calls.some(([url])=>url.includes('surveyed=true')&&url.includes('minRating=3.5'))).toBe(true);
 fireEvent.click(screen.getByText('Xóa bộ lọc phân nhóm'));await flush();
 expect(new URLSearchParams(window.location.search).has('minRating')).toBe(false);
 expect(new URLSearchParams(window.location.search).has('surveyed')).toBe(false);
});
it('filters at server, resets page, restores popstate and keeps all filters returning from profile',async()=>{
 adminApi.mockImplementation(async url=>url.endsWith('/profile')?{customer:user,summary:{totalOrders:5,completedOrders:5,cancelledOrders:0,returnOrders:0,completedValue:5000000},segmentation:user.segmentation}:url.includes('/profile/')?{content:[],totalElements:0,totalPages:0}:page);
 render(<ManagerApp/>);await flush();
 fireEvent.change(screen.getByLabelText('Nhóm khách hàng'),{target:{value:'LOYAL'}});await flush();
 fireEvent.change(screen.getByLabelText('Mua lại'),{target:{value:'true'}});await flush();
 fireEvent.change(screen.getByLabelText('Giá trị tối thiểu (đ)'),{target:{value:'5000000'}});await flush();
 expect(window.location.search).toContain('page=0');expect(adminApi.mock.calls.at(-1)[0]).toContain('stage=LOYAL');expect(adminApi.mock.calls.at(-1)[0]).toContain('dormant=true');
 const previous=window.location.search;
 fireEvent.click(screen.getByText('Xem hồ sơ'));await flush();expect(screen.getByText(/35 ngày/)).toBeTruthy();
 fireEvent.click(screen.getByText('← Danh sách khách hàng'));await flush();expect(new URLSearchParams(window.location.search).get('minCompletedValue')).toBe('5000000');
 window.history.replaceState({},'','/manager/users?q=B&page=1&stage=RETURNING&sort=completedOrders&direction=asc');fireEvent.popState(window);await flush();
 expect(screen.getByLabelText('Nhóm khách hàng').value).toBe('RETURNING');expect(adminApi.mock.calls.at(-1)[0]).toContain('page=1');
});
it('keeps previous data on network failure and stale list is not actionable when filters change',async()=>{
 render(<ManagerApp/>);await flush();fireEvent.click(screen.getByText('Mở khóa'));await flush();
 // A network failure keeps the last successful list and exposes retry, not a logout.
 adminApi.mockRejectedValue(new Error('Mất kết nối'));await act(async()=>vi.advanceTimersByTimeAsync(5000));
 expect(screen.getByText(user.fullName)).toBeTruthy();expect(screen.getByText('Chưa cập nhật được dữ liệu mới')).toBeTruthy();
 adminApi.mockReturnValue(new Promise(()=>{}));fireEvent.change(screen.getByLabelText('Nhóm khách hàng'),{target:{value:'NO_PURCHASE'}});await flush();
 expect(screen.getByText('Đang tải khách hàng...')).toBeTruthy();expect(screen.queryByText('Xem hồ sơ')).toBeNull();
});
it('pauses polling without overwriting the reason while a lock dialog is open',async()=>{
 adminApi.mockResolvedValue({...page,content:[{...user,locked:false}]});render(<ManagerApp/>);await flush();
 fireEvent.click(screen.getByRole('button',{name:'Khóa',exact:true}));await flush();
 fireEvent.change(screen.getByLabelText('Lý do khóa gửi đến người dùng'),{target:{value:'Giữ nội dung này'}});
 const calls=adminApi.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(10000));
 expect(adminApi.mock.calls).toHaveLength(calls);expect(screen.getByLabelText('Lý do khóa gửi đến người dùng').value).toBe('Giữ nội dung này');
});
