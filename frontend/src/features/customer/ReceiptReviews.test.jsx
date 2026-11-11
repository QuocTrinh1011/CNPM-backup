// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { OrdersPage, ReceiptAction, OrderView } from '../../app/App';
import OrderReviews from './OrderReviews';
import { api } from '../../api/api';
vi.mock('../../api/api', async original => ({ ...(await original()), api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const order = {
  id: 9,
  orderCode: 9009,
  status: 'DELIVERED',
  paymentMethod: 'COD',
  totalAmount: 100,
  items: [
    { productId: 2, name: 'Áo', quantity: 1 },
    { productId: 3, name: 'Quần', quantity: 1 },
  ],
};
const states = [
  { productId: 2, reviewed: false, canReview: true },
  { productId: 3, reviewed: false, canReview: true },
];
it('hides returns on a completed order with even one reviewed product', async () => {
  api.mockResolvedValue([{ productId: 2, reviewed: true, canReview: false }, states[1]]);
  render(<OrderView order={{ ...order, status: 'COMPLETED' }} />);
  await screen.findByText(
    'Đơn đã xác nhận nhận hàng và đã đánh giá sản phẩm nên không thể yêu cầu đổi trả.',
  );
  expect(screen.queryByText('YÊU CẦU ĐỔI/TRẢ')).toBeNull();
});
it('keeps returns available before the first review and hides them immediately after submitting', async () => {
  api.mockImplementation(async (path, options) => (options?.method === 'POST' ? {} : states));
  render(<OrderView order={{ ...order, status: 'COMPLETED' }} />);
  expect(await screen.findByText('YÊU CẦU ĐỔI/TRẢ')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Đánh giá Áo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));
  await screen.findByText(
    'Đơn đã xác nhận nhận hàng và đã đánh giá sản phẩm nên không thể yêu cầu đổi trả.',
  );
  expect(screen.queryByText('YÊU CẦU ĐỔI/TRẢ')).toBeNull();
});
it('does not expose returns when completed-order review loading fails', async () => {
  api.mockRejectedValue(new Error('Mất kết nối'));
  render(<OrderView order={{ ...order, status: 'COMPLETED' }} />);
  await screen.findByText('Mất kết nối');
  expect(screen.queryByText('YÊU CẦU ĐỔI/TRẢ')).toBeNull();
});
it.each([null, 9])(
  'opens a review immediately after receipt from route %s and preserves list filters',
  async orderId => {
    let completed = false;
    api.mockImplementation(async (path, options) => {
      if (options?.method === 'PATCH') {
        completed = true;
        return { ...order, status: 'COMPLETED' };
      }
      if (path.endsWith('/reviews')) return states;
      if (path === '/api/orders/9')
        return { ...order, status: completed ? 'COMPLETED' : 'DELIVERED' };
      return { content: completed ? [] : [order], totalPages: 3, totalElements: 1 };
    });
    // Local navigation uses the same route object as the storefront's History API adapter.
    render(<OrdersPage />);
    if (orderId) fireEvent.click(await screen.findByRole('button', { name: /Chi tiết đơn/ }));
    fireEvent.click(await screen.findByText('Đã nhận hàng'));
    fireEvent.click(screen.getByText('Xác nhận đã nhận'));
    expect(await screen.findByRole('dialog', { name: 'Đánh giá Áo' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Đóng'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('Quay lại danh sách'));
    await screen.findByText('Bạn chưa có đơn hàng');
    expect(api.mock.calls.filter(([path]) => path.endsWith('/confirm-receipt'))).toHaveLength(1);
  },
);
it('navigates to the completed order while preserving the original tab, keyword and page', async () => {
  const navigate = vi.fn();
  api.mockImplementation(async (path, options) =>
    options?.method ? { ...order, status: 'COMPLETED' } : { content: [order], totalPages: 3 },
  );
  render(
    <OrdersPage
      route={{ orderId: null, tab: 'TO_CONFIRM_RECEIPT', keyword: 'Áo', page: 1 }}
      onNavigate={navigate}
    />,
  );
  fireEvent.click(await screen.findByText('Đã nhận hàng'));
  fireEvent.click(screen.getByText('Xác nhận đã nhận'));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      orderId: 9,
      tab: 'TO_CONFIRM_RECEIPT',
      keyword: 'Áo',
      page: 1,
    }),
  );
});
it('does not open reviews if receipt API does not confirm completion', async () => {
  const changed = vi.fn();
  api.mockResolvedValue(order);
  render(<ReceiptAction order={order} onChanged={changed} />);
  fireEvent.click(screen.getByText('Đã nhận hàng'));
  fireEvent.click(screen.getByText('Xác nhận đã nhận'));
  await screen.findByText('Đơn chưa được xác nhận hoàn thành. Vui lòng thử lại.');
  expect(changed).not.toHaveBeenCalled();
});
it('retries review loading without re-confirming receipt and opens only once', async () => {
  const consumed = vi.fn();
  api.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(states);
  const view = render(
    <OrderReviews order={{ ...order, status: 'COMPLETED' }} autoOpen onAutoOpened={consumed} />,
  );
  await screen.findByText(/Đơn đã xác nhận thành công/);
  fireEvent.click(screen.getByText('Thử lại'));
  const dialog = await screen.findByRole('dialog', { name: 'Đánh giá Áo' });
  expect(document.activeElement).toBe(dialog);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  view.rerender(
    <OrderReviews order={{ ...order, status: 'COMPLETED' }} autoOpen onAutoOpened={consumed} />,
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(consumed).toHaveBeenCalledTimes(1);
  expect(api.mock.calls.every(([path]) => path.endsWith('/reviews'))).toBe(true);
});
it('skips reviewed products, deduplicates variants and offers the next product after submission', async () => {
  let sent = false;
  api.mockImplementation(async (path, options) => {
    if (options?.method) {
      sent = true;
      return {};
    }
    return [
      { productId: 1, reviewed: true, canReview: false },
      { ...states[0], reviewed: sent, canReview: !sent },
      states[1],
    ];
  });
  render(
    <OrderReviews
      autoOpen
      order={{
        ...order,
        status: 'COMPLETED',
        items: [{ productId: 1, name: 'Cũ' }, ...order.items, order.items[0]],
      }}
    />,
  );
  await screen.findByRole('dialog', { name: 'Đánh giá Áo' });
  fireEvent.click(screen.getByText('Gửi đánh giá'));
  fireEvent.click(await screen.findByText('Đánh giá sản phẩm tiếp theo'));
  expect(screen.getByRole('dialog', { name: 'Đánh giá Quần' })).toBeTruthy();
  expect(api.mock.calls.filter(([, options]) => options?.method)).toHaveLength(1);
});
it('does not open a dialog with no eligible products or on an ordinary refreshed detail', async () => {
  api.mockResolvedValue(states.map(s => ({ ...s, reviewed: true, canReview: false })));
  const view = render(<OrderReviews autoOpen order={{ ...order, status: 'COMPLETED' }} />);
  await screen.findAllByText('Đã đánh giá');
  expect(screen.queryByRole('dialog')).toBeNull();
  view.unmount();
  api.mockResolvedValue(states);
  render(<OrderReviews order={{ ...order, status: 'COMPLETED' }} />);
  await screen.findByText('Đánh giá Áo');
  expect(screen.queryByRole('dialog')).toBeNull();
});
