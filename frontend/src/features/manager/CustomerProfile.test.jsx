// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, afterEach, it, vi, expect } from 'vitest';
import ManagerApp from '../../ManagerApp';
import { adminApi, adminRefreshSession } from '../../api/manager-api';
vi.mock('../../api/manager-api', async original => ({ ...await original(), adminApi: vi.fn(), adminRefreshSession: vi.fn() }));
const profile = (name='Customer A') => ({ customer: { id: 1, fullName: name, email: 'customer@test.vn', locked: true, lockReason: 'Lý do thử nghiệm' }, summary: { totalOrders: 2, completedOrders: 1, cancelledOrders: 1, returnOrders: 0, completedValue: 90000 } });
const page = (content=[]) => ({ content, totalElements: content.length, totalPages: content.length ? 1 : 0 });
const flush = async () => { await act(async () => { await import('./CustomerProfile'); await vi.advanceTimersByTimeAsync(0); }); };
it('loads the activity timeline on its own URL and opens linked orders',async()=>{
  window.history.replaceState({},'','/manager/users/1?tab=activities&q=Alice&page=2');
  adminApi.mockImplementation(async url=>url.endsWith('/profile')?profile():url.includes('/activities')?page([{id:'ORDER:9:CREATED',type:'ORDER',targetId:9,action:'CREATED',createdAt:'2026-10-16T01:00:00Z'}]):{id:9,orderCode:9009,status:'COMPLETED',items:[]});
  render(<ManagerApp/>);await flush();
  expect(screen.getByText('Đơn hàng #9')).toBeTruthy();
  expect(adminApi.mock.calls.some(([url])=>url.includes('/activities?page=0&size=10'))).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Chi tiết đơn'}));await flush();
  expect(adminApi.mock.calls.some(([url])=>url==='/api/manager/orders/9')).toBe(true);
});
it('labels customer cancellations and receipt confirmations distinctly on the timeline',async()=>{
  window.history.replaceState({},'','/manager/users/1?tab=activities');
  adminApi.mockImplementation(async url=>url.endsWith('/profile')?profile():page([
    {id:'ORDER:1:CUSTOMER_CANCEL',type:'ORDER',targetId:9,action:'CUSTOMER_CANCEL',createdAt:'2026-10-16T01:00:00Z'},
    {id:'ORDER:2:CUSTOMER_RECEIPT',type:'ORDER',targetId:10,action:'CUSTOMER_RECEIPT',createdAt:'2026-10-16T02:00:00Z'},
  ]));
  render(<ManagerApp/>);await flush();
  expect(screen.getByText(/Khách hàng đã hủy đơn/)).toBeTruthy();
  expect(screen.getByText(/Khách hàng đã xác nhận nhận hàng/)).toBeTruthy();
  expect(screen.getAllByRole('button',{name:'Chi tiết đơn'})).toHaveLength(2);
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  adminRefreshSession.mockResolvedValue({manager:{fullName:'Manager'}});
  adminApi.mockReset();
  adminApi.mockImplementation(async url => url.endsWith('/profile') ? profile() : page());
  window.history.replaceState({},'', '/manager/users/1?q=Alice&page=2');
});
afterEach(() => {cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('opens a direct profile, restores list query/page and sends search to the server', async () => {
  render(<ManagerApp/>);await flush();
  expect(window.location.pathname).toBe('/manager/users/1');
  expect(screen.getByText('Customer A')).toBeTruthy();
  expect(screen.getByText('Lý do thử nghiệm')).toBeTruthy();
  expect(screen.getAllByText('Chưa khai báo').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button',{name:'← Danh sách khách hàng'}));await flush();
  expect(window.location.search).toBe('?q=Alice&page=2');
  expect(adminApi.mock.calls.some(([url])=>url.includes('/users?q=Alice&page=2'))).toBe(true);
  const input=screen.getByPlaceholderText('Tìm theo tên, email, SĐT...');
  fireEvent.change(input,{target:{value:'090123'}});
  fireEvent.click(screen.getByText('Tìm khách hàng'));await flush();
  expect(adminApi.mock.calls.some(([url])=>url.includes('q=090123&page=0'))).toBe(true);
});
it('loads only the selected tab, keeps its page in the URL and handles popstate', async () => {
  adminApi.mockImplementation(async url => url.endsWith('/profile') ? profile() : url.includes('/feedback') ? {content:[{id:7,productName:'Shirt',rating:5,hidden:true,status:'NEW'}],totalElements:11,totalPages:2} : page());
  render(<ManagerApp/>);await flush();
  expect(adminApi.mock.calls.some(([url])=>url.includes('/surveys'))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Đánh giá',exact:true}));await flush();
  expect(screen.getByText('Shirt')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Sau'}));await flush();
  expect(window.location.search).toContain('historyPage=1');
  expect(adminApi.mock.calls.some(([url])=>url.includes('/feedback?page=1&size=10'))).toBe(true);
  window.history.replaceState({},'', '/manager/users/1?q=Alice&page=2&tab=addresses');
  fireEvent.popState(window);await flush();
  expect(screen.getByRole('button',{name:'Địa chỉ',exact:true}).getAttribute('aria-current')).toBe('page');
});
it('polls without replacing identity on network failure, retries and opens the shared order dialog', async () => {
  let fail=false;
  adminApi.mockImplementation(async url => {
    if(fail) throw new Error('Mất kết nối');
    if(url.endsWith('/profile'))return profile();
    if(url==='/api/manager/orders/9')return {id:9,orderCode:9009,status:'COMPLETED',paymentStatus:'PAID',items:[],customer:{fullName:'Customer A'}};
    return page([{id:9,orderCode:9009,status:'COMPLETED',paymentStatus:'PAID',returnStatus:'REQUESTED',totalAmount:90000}]);
  });
  render(<ManagerApp/>);await flush();
  fireEvent.click(screen.getByText('Chi tiết đơn'));await flush();
  expect(within(screen.getByRole('dialog')).getByText('Đã thanh toán')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});await flush();
  expect(screen.queryByRole('dialog')).toBeNull();
  fail=true;await act(async()=>vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByText('Customer A')).toBeTruthy();expect(screen.getByText('Chưa cập nhật được dữ liệu mới')).toBeTruthy();
  fail=false;fireEvent.click(screen.getByText('Thử lại'));await flush();
  expect(screen.queryByText('Chưa cập nhật được dữ liệu mới')).toBeNull();
});
it('shows deleted survey participation and both private voucher and historical usage lists', async () => {
  adminApi.mockImplementation(async url=>url.endsWith('/profile')?profile():url.includes('/surveys')?page([{id:2,title:'Old survey',deleted:true,rewarded:true}]):url.includes('/voucher-usages')?page([{orderId:3,orderCode:33,code:'OLD',discountAmount:100,orderStatus:'CANCELLED',releaseStatus:'UNKNOWN'}]):url.includes('/vouchers')?page([{id:4,code:'OWN',discountType:'PERCENTAGE',discountValue:10,status:'EXPIRED'}]):page());
  render(<ManagerApp/>);await flush();
  fireEvent.click(within(screen.getByRole('navigation',{name:'Nội dung hồ sơ'})).getByRole('button',{name:'Khảo sát',exact:true}));await flush();
  expect(screen.getByText('Old survey')).toBeTruthy();expect(screen.getByText('Đã xóa')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Voucher',exact:true}));await flush();
  expect(screen.getByText('OWN')).toBeTruthy();expect(screen.getByText('OLD')).toBeTruthy();
  expect(screen.getByText(/Chưa có dữ liệu hoàn lượt/)).toBeTruthy();
});
it('ignores a response from the previous customer and stops polling after navigation', async () => {
  let resolveOld;
  adminApi.mockImplementation(url => url==='/api/manager/users/1/profile'?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(url.endsWith('/profile')?profile('Customer B'):page()));
  render(<ManagerApp/>);await flush();
  window.history.replaceState({},'', '/manager/users/2');fireEvent.popState(window);await flush();
  expect(screen.getByText('Customer B')).toBeTruthy();
  await act(async()=>resolveOld(profile('Stale customer')));
  expect(screen.queryByText('Stale customer')).toBeNull();
  const count=adminApi.mock.calls.filter(([url])=>url.includes('/users/1/profile')).length;
  await act(async()=>vi.advanceTimersByTimeAsync(5000));
  expect(adminApi.mock.calls.filter(([url])=>url.includes('/users/1/profile'))).toHaveLength(count);
});
it('shows a clear initial error and allows retry without changing the route', async () => {
  let failed=false;
  adminApi.mockImplementation(async url=>{if(url.endsWith('/profile')){if(!failed){failed=true;throw new Error('Không tìm thấy khách hàng.');}return profile();}return url.endsWith('/notifications/summary')?{unreadCount:0}:page();});
  render(<ManagerApp/>);await flush();expect(screen.getByRole('alert').textContent).toContain('Không tìm thấy khách hàng.');
  fireEvent.click(screen.getByText('Thử lại'));await flush();expect(screen.getByText('Customer A')).toBeTruthy();
  expect(window.location.pathname).toBe('/manager/users/1');
});
