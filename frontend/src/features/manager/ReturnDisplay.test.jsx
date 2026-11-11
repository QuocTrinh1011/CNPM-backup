// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { OrdersPage } from '../../app/App';
import ManagerOrderDetail from './ManagerOrderDetail';
import { displayOrderLabel } from '../../shared/utils/order-display';
import { api } from '../../api/api';
vi.mock('../../api/api', async original => ({ ...(await original()), api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const label = 'Đã yêu cầu đổi trả — chờ xử lý';
const order = {
  id: 9,
  orderCode: 9009,
  status: 'DELIVERED',
  returnStatus: 'NONE',
  paymentMethod: 'COD',
  items: [],
  totalAmount: 100,
};
it.each(['DELIVERED', 'COMPLETED'])(
  'shows the return instead of delivery on the customer list (%s)',
  async status => {
    api.mockResolvedValue({
      content: [{ ...order, status, returnStatus: 'REQUESTED' }],
      totalElements: 1,
      totalPages: 1,
    });
    render(<OrdersPage />);
    expect(await screen.findByText(label)).toBeTruthy();
    expect(screen.queryByText('Đã giao — chờ bạn xác nhận')).toBeNull();
    expect(screen.queryByText('Đã nhận hàng')).toBeNull();
  },
);
it('updates from the return response before the detail reload completes and preserves the reason on failure', async () => {
  let returnSent = false;
  api.mockImplementation(async (path, options) => {
    if (options?.method) {
      if (!returnSent) {
        returnSent = true;
        throw new Error('Mất kết nối');
      }
      return { ...order, returnStatus: 'REQUESTED', returnReason: 'Sai sản phẩm' };
    }
    if (returnSent) return new Promise(() => {});
    return order;
  });
  render(<OrdersPage route={{ orderId: 9, tab: 'TO_CONFIRM_RECEIPT', keyword: '', page: 0 }} />);
  fireEvent.click(await screen.findByText('YÊU CẦU ĐỔI/TRẢ'));
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Sai sản phẩm' } });
  fireEvent.click(screen.getByText('Xác nhận'));
  await screen.findByText('Mất kết nối');
  expect(screen.getByLabelText('Lý do').value).toBe('Sai sản phẩm');
  fireEvent.click(screen.getByText('Xác nhận'));
  expect(await screen.findByText(label, { exact: true })).toBeTruthy();
  expect(screen.getByText('Sai sản phẩm')).toBeTruthy();
  expect(screen.queryByText('Đã giao — chờ bạn xác nhận')).toBeNull();
  expect(screen.queryByText('YÊU CẦU ĐỔI/TRẢ')).toBeNull();
});
it('preserves cancellation priority and displays separate shipping and payment in manager detail', () => {
  expect(
    displayOrderLabel(
      { ...order, status: 'CANCELLED', returnStatus: 'REQUESTED' },
      { CANCELLED: 'Đã hủy' },
    ),
  ).toBe('Đã hủy');
  render(
    <ManagerOrderDetail
      detail={{
        ...order,
        returnStatus: 'REQUESTED',
        returnReason: 'Sai size',
        paymentStatus: 'PAID',
      }}
      onClose={() => {}}
    />,
  );
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getAllByText(label).length).toBeGreaterThan(0);
  expect(dialog.getByText('Đã giao', { exact: true })).toBeTruthy();
  expect(dialog.getByText('Đã thanh toán')).toBeTruthy();
  expect(dialog.getByText('Sai size')).toBeTruthy();
  expect(dialog.queryByText('Đã giao — chờ khách xác nhận')).toBeNull();
});
