// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import ManagerRefunds, { OrderFinancePanel } from './ManagerRefunds';
import RefundSummary from '../customer/RefundSummary';
import { adminApi } from '../../api/manager-api';
vi.mock('../../api/manager-api', () => ({ adminApi: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.history.replaceState({}, '', '/');
});
const order = {
  id: 9,
  status: 'CANCELLED',
  paymentMethod: 'PAYOS',
  paymentStatus: 'PAID',
  totalAmount: 100000,
  finance: {
    refund: { status: 'NONE', refundedAmount: 0, pendingAmount: 0, availableAmount: 100000 },
  },
};
it('shows a partial refund and its outstanding pending amount together', () => {
  render(
    <RefundSummary refund={{ status: 'PARTIAL', refundedAmount: 30000, pendingAmount: 70000 }} />,
  );
  expect(screen.getByText('Đã hoàn một phần')).toBeTruthy();
  expect(screen.getByText(/Còn khoản chờ xử lý/)).toBeTruthy();
});
it('keeps the form and the idempotency key after a failed create', async () => {
  let fail = true;
  adminApi.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      if (fail) throw new Error('Mất mạng');
      return { id: 1 };
    }
    return path.endsWith('/refunds') ? [] : order;
  });
  render(<OrderFinancePanel order={order} onUpdated={vi.fn()} />);
  await screen.findByText('Chưa có khoản hoàn tiền.');
  fireEvent.click(screen.getByText('Tạo khoản hoàn'));
  fireEvent.change(screen.getByLabelText(/Số tiền hoàn/), { target: { value: '30000' } });
  fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Giữ nội dung' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Tạo khoản hoàn' }));
  await screen.findByText('Mất mạng');
  expect(screen.getByLabelText('Ghi chú').value).toBe('Giữ nội dung');
  const key = adminApi.mock.calls.find(([, o]) => o?.method === 'POST')[1].body.requestKey;
  fail = false;
  fireEvent.submit(screen.getByRole('form', { name: 'Tạo khoản hoàn' }));
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Tạo khoản hoàn' })).toBeNull());
  const posts = adminApi.mock.calls.filter(([, o]) => o?.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(posts[1][1].body.requestKey).toBe(key);
});
it('requires a transfer reference and keeps process notes on API failure', async () => {
  window.history.replaceState({}, '', '/manager/refunds');
  adminApi.mockImplementation(async (path, options) => {
    if (options?.method) throw new Error('Chưa lưu được');
    return { content: [{ id: 1, orderCode: 99, amount: 30000, status: 'PENDING' }], totalPages: 1 };
  });
  render(<ManagerRefunds />);
  fireEvent.click(await screen.findByText('Xử lý'));
  expect(screen.getByLabelText('Mã chuyển hoàn').required).toBe(true);
  fireEvent.change(screen.getByLabelText('Mã chuyển hoàn'), { target: { value: 'BANK-1' } });
  fireEvent.change(screen.getByLabelText('Ghi chú xử lý'), {
    target: { value: 'Ghi chú giữ lại' },
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Xử lý khoản hoàn' }));
  await screen.findByText('Chưa lưu được');
  expect(screen.getByLabelText('Ghi chú xử lý').value).toBe('Ghi chú giữ lại');
});
it('does not offer COD collection before delivery or after collection', async () => {
  adminApi.mockResolvedValue([]);
  const { rerender } = render(
    <OrderFinancePanel
      order={{ ...order, status: 'PENDING', paymentMethod: 'COD' }}
      onUpdated={vi.fn()}
    />,
  );
  expect(screen.queryByText('Xác nhận đã thu COD')).toBeNull();
  rerender(
    <OrderFinancePanel
      order={{
        ...order,
        status: 'DELIVERED',
        paymentMethod: 'COD',
        finance: { ...order.finance, codCollectedAt: '2026-10-19T00:00:00Z' },
      }}
      onUpdated={vi.fn()}
    />,
  );
  expect(screen.queryByText('Xác nhận đã thu COD')).toBeNull();
});
