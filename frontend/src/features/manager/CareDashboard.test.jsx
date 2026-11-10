// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import CareDashboard from './CareDashboard';
import {adminApi} from '../../api/manager-api';
vi.mock('../../api/manager-api',()=>({adminApi:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const counts={total:3,todo:1,inProgress:1,completed:1,overdue:2};
it('loads counts, preserves date filters in drilldown and loads dormant customers only on demand',async()=>{
 adminApi.mockImplementation(async url=>url.includes('/dormant')?{content:[{id:9,fullName:'Khách cần gọi',lastPurchaseAt:'2026-01-01T00:00:00Z'}],totalPages:1}:{counts,staff:[{id:4,name:'Quản lý A',active:false,counts}],dormantWithoutOpenTask:1,asOf:'2026-10-06T00:00:00Z'});
 const go=vi.fn();render(<CareDashboard go={go} location="care-dashboard?from=2026-10-01&to=2026-10-06"/>);
 await screen.findByText('Quản lý A (không còn hoạt động)');expect(adminApi.mock.calls.some(([url])=>url.includes('/dormant'))).toBe(false);
 fireEvent.click(screen.getByText('Quá hạn'));expect(go.mock.calls.at(-1)[0]).toContain('overdue=true');expect(go.mock.calls.at(-1)[0]).toContain('from=2026-10-01');
 fireEvent.click(screen.getByText('Hoàn thành: 1'));expect(go.mock.calls.at(-1)[0]).toContain('assigneeId=4');expect(go.mock.calls.at(-1)[0]).toContain('status=COMPLETED');
 fireEvent.click(screen.getByText('Khách chưa có chăm sóc: 1'));await screen.findByText('Khách cần gọi');fireEvent.click(screen.getByText('Tạo chăm sóc'));expect(go).toHaveBeenLastCalledWith('care?customerId=9');
});
it('shows error and retries without inventing counts',async()=>{
 adminApi.mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValue({counts,staff:[],dormantWithoutOpenTask:0,asOf:'2026-10-06T00:00:00Z'});
 render(<CareDashboard go={vi.fn()} location="care-dashboard"/>);await screen.findByText(/Mất kết nối/);fireEvent.click(screen.getByText('Thử lại'));await waitFor(()=>expect(screen.getByText('Chưa có công việc phù hợp.')).toBeTruthy());
});
