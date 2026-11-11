// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import AuditLogs from './AuditLogs';
import {adminApi} from '../../api/api';
vi.mock('../../api/api',async original=>({...await original(),adminApi:vi.fn()}));
const data={content:[{id:1,actorName:'Quản lý',actorRole:'MANAGER',actorId:2,action:'ORDER_STATUS',entityType:'ORDER',targetId:7,createdAt:'2026-10-15T10:00:00Z',beforeData:{status:'PENDING'},afterData:{status:'CONFIRMED'}}],totalElements:21,totalPages:2};
const flush=async()=>{await act(async()=>{});};
beforeEach(()=>{vi.useFakeTimers();window.history.replaceState({},'','/admin/audit-logs');adminApi.mockReset();adminApi.mockResolvedValue(data);});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('shows before/after, filters before pagination and restores URL',async()=>{
 render(<AuditLogs/>);await flush();expect(screen.getByText('Đổi trạng thái đơn · Đơn hàng #7')).toBeTruthy();expect(screen.getByText('PENDING')).toBeTruthy();expect(screen.getByText('CONFIRMED')).toBeTruthy();
 fireEvent.click(screen.getByText('Trang sau'));await flush();expect(window.location.search).toContain('page=1');expect(adminApi.mock.calls.at(-1)[0]).toContain('/api/admin/audit-logs');
 fireEvent.change(screen.getByLabelText('Chức năng'),{target:{value:'PRODUCT'}});await flush();expect(window.location.search).not.toContain('page=1');expect(adminApi.mock.calls.at(-1)[0]).toContain('type=PRODUCT');
 fireEvent.change(screen.getByLabelText('Tìm nhật ký'),{target:{value:'Quản lý'}});fireEvent.click(screen.getByText('Tìm kiếm'));await flush();expect(window.location.search).toContain('q=');
 window.history.replaceState({},'','/admin/audit-logs?action=LOCK');act(()=>window.dispatchEvent(new PopStateEvent('popstate')));await flush();expect(screen.getByLabelText('Thao tác').value).toBe('LOCK');
});
it('retries, shows the empty state and does not poll',async()=>{
 adminApi.mockRejectedValueOnce(new Error('Offline'));render(<AuditLogs/>);await flush();expect(screen.getByRole('alert').textContent).toContain('Offline');adminApi.mockResolvedValue({content:[],totalElements:0,totalPages:0});fireEvent.click(screen.getByText('Thử lại'));await flush();expect(screen.getByText('Chưa có nhật ký phù hợp.')).toBeTruthy();const calls=adminApi.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(10000));expect(adminApi).toHaveBeenCalledTimes(calls);
});
it('filters care history and labels metadata',async()=>{
 adminApi.mockResolvedValue({...data,content:[{...data.content[0],entityType:'CARE_TASK',action:'UPDATE',targetId:42,beforeData:{assigneeId:2,status:'TODO'},afterData:{assigneeId:3,status:'COMPLETED',outcome:'RESOLVED',parentTaskId:10}}]});
 render(<AuditLogs/>);await flush();expect(screen.getByText('Cập nhật · Công việc chăm sóc #42')).toBeTruthy();expect(screen.getByText('ID người phụ trách')).toBeTruthy();expect(screen.getByText('Công việc trước')).toBeTruthy();fireEvent.change(screen.getByLabelText('Chức năng'),{target:{value:'CARE_TASK'}});await flush();expect(adminApi.mock.calls.at(-1)[0]).toContain('type=CARE_TASK');
});
it('allows filtering promotion campaign history',async()=>{
 adminApi.mockResolvedValue({...data,content:[{...data.content[0],entityType:'PROMOTION_CAMPAIGN',action:'CREATE',targetId:12,beforeData:{},afterData:{code:'SUMMER26',name:'Summer sale',startDate:'2026-11-01',endDate:'2026-11-30',productRules:[{productId:7,discountPercent:10}],invoiceRules:[],voucherRules:[]}}]});
 render(<AuditLogs/>);await flush();
 expect(screen.getByRole('option',{name:'Chiến dịch khuyến mãi'})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Chức năng'),{target:{value:'PROMOTION_CAMPAIGN'}});await flush();
 expect(screen.getByText('Tạo mới · Chiến dịch khuyến mãi #12')).toBeTruthy();
 expect(adminApi.mock.calls.at(-1)[0]).toContain('type=PROMOTION_CAMPAIGN');
 fireEvent.click(screen.getByText('Xem dữ liệu trước / sau'));
 expect(screen.getByText('Mã chiến dịch')).toBeTruthy();
 expect(screen.getByText('Tên chiến dịch')).toBeTruthy();
 expect(screen.getByText('Quy tắc sản phẩm')).toBeTruthy();
 expect(screen.getByText('[{"productId":7,"discountPercent":10}]')).toBeTruthy();
});
