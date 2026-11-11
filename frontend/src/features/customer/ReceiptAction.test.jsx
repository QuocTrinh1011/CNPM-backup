// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import { ReceiptAction } from '../../app/App';
import { api } from '../../api/api';
vi.mock('../../api/api', async original => ({ ...(await original()), api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const order = { id: 1, orderCode: 100, status: 'DELIVERED', returnStatus: 'NONE' };
it('confirms explicitly, keeps errors retryable and updates the order', async () => {
  const changed = vi.fn();
  render(<ReceiptAction order={order} onChanged={changed} />);
  fireEvent.click(screen.getByText('Đã nhận hàng'));
  fireEvent.click(screen.getByText('Quay lại'));
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Đã nhận hàng'));
  api.mockRejectedValueOnce(new Error('Lỗi kết nối'));
  fireEvent.click(screen.getByText('Xác nhận đã nhận'));
  await screen.findByText('Lỗi kết nối');
  api.mockResolvedValueOnce({ ...order, status: 'COMPLETED' });
  fireEvent.click(screen.getByText('Xác nhận đã nhận'));
  await vi.waitFor(() => expect(changed).toHaveBeenCalledWith({ ...order, status: 'COMPLETED' }));
  expect(api).toHaveBeenCalledWith('/api/orders/1/confirm-receipt', { method: 'PATCH' });
});
it('hides confirmation for undelivered, completed and return orders', () => {
  const view = render(<ReceiptAction order={{ ...order, status: 'SHIPPED' }} />);
  expect(screen.queryByText('Đã nhận hàng')).toBeNull();
  view.rerender(<ReceiptAction order={{ ...order, returnStatus: 'REQUESTED' }} />);
  expect(screen.queryByText('Đã nhận hàng')).toBeNull();
  view.rerender(<ReceiptAction order={{ ...order, status: 'COMPLETED' }} />);
  expect(screen.queryByText('Đã nhận hàng')).toBeNull();
});
