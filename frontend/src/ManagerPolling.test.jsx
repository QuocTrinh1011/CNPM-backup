// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, it, vi, expect } from 'vitest';
import ManagerApp from './ManagerApp';
import AdminVouchers from './AdminVouchers';
import { adminApi, adminRefreshSession } from './api/manager-api';
vi.mock('./api/manager-api', async original => ({ ...await original(), adminApi: vi.fn(), adminRefreshSession: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  adminApi.mockReset();
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Manager' } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const flush = async () => { await act(async () => {}); };
const tick = async () => { await act(async () => vi.advanceTimersByTimeAsync(5000)); };
it('polls return status into desktop/mobile badges and disables the delivery selectors', async () => {
  window.history.replaceState({}, '', '/manager/orders');
  let requested=false;
  adminApi.mockImplementation(async url=>{
    const order={id:9,orderCode:9009,status:'DELIVERED',returnStatus:requested?'REQUESTED':'NONE',paymentMethod:'COD',items:[]};
    return url==='/api/manager/orders/9'?order:{content:[order],totalPages:1};
  });
  render(<ManagerApp/>);await flush();requested=true;await tick();
  expect(screen.getAllByText('Đã yêu cầu đổi trả — chờ xử lý')).toHaveLength(2);
  for(const select of screen.getAllByLabelText('Cập nhật trạng thái đơn 9009')) {
    expect(select.disabled).toBe(true);expect(select.value).toBe('DELIVERED');expect(select.textContent).toBe('Đang đổi trả');
  }
  expect(document.querySelector('.admin-badge').textContent).not.toContain('chờ khách xác nhận');
});
it('automatically displays a new order and refreshes an open payment detail', async () => {
  window.history.replaceState({}, '', '/manager/orders');
  let exists = false, paid = false;
  const order = () => ({ id: 9, orderCode: 9009, status: 'PENDING', paymentMethod: 'PAYOS', paymentStatus: paid ? 'PAID' : 'PENDING', totalAmount: 100, items: [] });
  adminApi.mockImplementation(async url => url === '/api/manager/orders/9' ? order() : { content: exists ? [order()] : [], totalPages: 1 });
  render(<ManagerApp/>); await flush();
  expect(screen.queryByText('#9009')).toBeNull();
  exists = true; await tick();
  expect(screen.getAllByText('#9009').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Chi tiết', exact: true })); await flush();
  expect(screen.getByRole('dialog').textContent).toContain('Chờ thanh toán');
  paid = true; await tick();
  expect(screen.getByRole('dialog').textContent).toContain('Đã thanh toán');
  fireEvent.click(screen.getByLabelText('Đóng chi tiết')); await flush();
  const calls = adminApi.mock.calls.filter(([url]) => url === '/api/manager/orders/9').length;
  await tick();
  expect(adminApi.mock.calls.filter(([url]) => url === '/api/manager/orders/9')).toHaveLength(calls);
});
it('preserves a voucher draft while its list polls and after a network failure', async () => {
  adminApi.mockResolvedValue({ content: [], totalPages: 0 });
  render(<AdminVouchers/>); await flush();
  fireEvent.click(screen.getByText('Tạo mã'));
  fireEvent.change(screen.getByLabelText('Mã giảm giá'), { target: { value: 'DRAFT' } });
  await tick();
  expect(screen.getByLabelText('Mã giảm giá').value).toBe('DRAFT');
  adminApi.mockRejectedValueOnce(new Error('Offline')); await tick();
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByLabelText('Mã giảm giá').value).toBe('DRAFT');
  expect(adminApi).toHaveBeenCalledTimes(3);
});
it('returns to manager login after a polling request loses authorization', async () => {
  window.history.replaceState({}, '', '/manager/orders');
  adminApi.mockResolvedValue({ content: [], totalPages: 0 });
  render(<ManagerApp/>); await flush();
  adminApi.mockRejectedValue(Object.assign(new Error('Expired'), { status: 401 }));
  await tick();
  expect(window.location.pathname).toBe('/manager/login');
  const calls = adminApi.mock.calls.length;
  await tick(); expect(adminApi).toHaveBeenCalledTimes(calls);
});
