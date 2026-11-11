// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminVouchers from './AdminVouchers';
import AdminApp from '../manager/ManagerApp';
import { adminApi, adminRefreshSession } from '../../api/manager-api';
vi.mock('../../api/manager-api', async original => ({
  ...(await original()),
  adminApi: vi.fn(),
  adminRefreshSession: vi.fn(),
}));
const voucher = {
  id: 1,
  code: 'SHOP10',
  description: 'Khuyến mãi',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  minOrderAmount: 0,
  usedCount: 1,
  usageLimit: 10,
  active: true,
  state: 'ACTIVE',
  totalDiscount: 10000,
};
beforeEach(() => {
  vi.resetAllMocks();
  adminApi.mockResolvedValue({ content: [voucher], totalPages: 2 });
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Admin' } });
});
afterEach(cleanup);
it('defaults new vouchers to one use per customer but preserves old unlimited settings', async () => {
  render(<AdminVouchers />);
  await screen.findByText('SHOP10');
  fireEvent.click(screen.getByText('Tạo mã'));
  expect(screen.getByLabelText('Tối đa mỗi khách').value).toBe('1');
  fireEvent.click(screen.getByText('Đóng'));
  fireEvent.click(screen.getByText('Sửa'));
  expect(screen.getByLabelText('Tối đa mỗi khách').value).toBe('');
  fireEvent.change(screen.getByLabelText('Tối đa mỗi khách'), { target: { value: '1' } });
  expect(screen.getByText(/Giảm giới hạn chỉ áp dụng/)).toBeTruthy();
});
it('renders via direct admin route, filters, searches and paginates', async () => {
  window.history.replaceState({}, '', '/manager/vouchers');
  render(<AdminApp />);
  await screen.findByText('SHOP10');
  fireEvent.change(screen.getByLabelText('Tìm mã giảm giá'), { target: { value: 'SHOP' } });
  fireEvent.click(screen.getByLabelText('Tìm kiếm'));
  await waitFor(() => expect(adminApi.mock.calls.at(-1)[0]).toContain('search=SHOP'));
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACTIVE' } });
  await waitFor(() => expect(adminApi.mock.calls.at(-1)[0]).toContain('state=ACTIVE'));
  await waitFor(() => expect(screen.getByText('Sau').disabled).toBe(false));
  fireEvent.click(screen.getByText('Sau'));
  await waitFor(() => expect(adminApi.mock.calls.at(-1)[0]).toContain('page=1'));
});
it('creates a normalized fixed voucher and preserves form after API failure', async () => {
  render(<AdminVouchers />);
  await screen.findByText('SHOP10');
  fireEvent.click(screen.getByText('Tạo mã'));
  fireEvent.change(screen.getByLabelText('Mã giảm giá'), { target: { value: 'sale30' } });
  fireEvent.change(screen.getByLabelText('Loại giảm'), { target: { value: 'FIXED_AMOUNT' } });
  fireEvent.change(screen.getByLabelText('Giá trị giảm'), { target: { value: '30000' } });
  adminApi.mockRejectedValueOnce(new Error('Mã đã tồn tại'));
  fireEvent.click(screen.getByText('Lưu mã'));
  await screen.findByText('Mã đã tồn tại');
  expect(screen.getByLabelText('Mã giảm giá').value).toBe('SALE30');
  expect(adminApi).toHaveBeenCalledWith(
    '/api/manager/vouchers',
    expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        code: 'SALE30',
        discountType: 'FIXED_AMOUNT',
        discountValue: 30000,
        usageLimit: null,
      }),
    }),
  );
  fireEvent.click(screen.getByText('Lưu mã'));
  await screen.findByText('Đã lưu mã giảm giá.');
});
it('keeps code immutable on edit and disables repeated mutations', async () => {
  render(<AdminVouchers />);
  await screen.findByText('SHOP10');
  fireEvent.click(screen.getByText('Sửa'));
  expect(screen.getByLabelText('Mã giảm giá').disabled).toBe(true);
  fireEvent.click(screen.getByText('Đóng'));
  let finish;
  adminApi.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));
  fireEvent.click(screen.getByText('Tắt'));
  fireEvent.click(screen.getByText('Tắt'));
  expect(adminApi.mock.calls.filter(([, args]) => args?.method === 'PATCH')).toHaveLength(1);
  finish({});
  await screen.findByText('Đã tắt mã giảm giá.');
});
it('recovers list errors with retry', async () => {
  adminApi.mockRejectedValueOnce(new Error('Không kết nối được'));
  render(<AdminVouchers />);
  await screen.findByText('Không kết nối được');
  fireEvent.click(screen.getByText('Thử lại'));
  await screen.findByText('SHOP10');
});
