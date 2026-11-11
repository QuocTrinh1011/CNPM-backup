// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import App, { OrdersModal, OrderView } from './App';
import CheckoutPage from '../features/storefront/CheckoutPage';
import { api, refreshSession } from '../api/api';
vi.mock('../api/api', async original => ({
  ...(await original()),
  api: vi.fn(),
  refreshSession: vi.fn(),
}));
const product = {
  id: 1,
  name: 'Áo kiểm thử',
  price: 200000,
  stock: 5,
  sizes: 'M,L',
  colors: 'Đen',
  imageUrl: '/test.png',
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  window.scrollTo = vi.fn();
  refreshSession.mockResolvedValue(null);
  api.mockImplementation(async path =>
    path.includes('categories')
      ? ['Áo thun']
      : { content: [product], totalPages: 1, totalElements: 1 },
  );
});
afterEach(cleanup);
it('keeps the size-exchange announcement without a free-shipping promotion in both themes', () => {
  const view = render(<App />);
  const banner = view.container.querySelector('.announcement');
  expect(banner.textContent).toContain('ĐỔI SIZE TRONG 30 NGÀY');
  expect(banner.textContent).toContain('ANH LỚN / NEW FORM');
  expect(banner.textContent).not.toMatch(/699|miễn phí|freeship/i);
  fireEvent.click(screen.getByLabelText('Chuyển sang chế độ tối'));
  expect(banner.textContent).toContain('ĐỔI SIZE TRONG 30 NGÀY');
  expect(banner.textContent).not.toMatch(/699|miễn phí|freeship/i);
});
it('defaults to light theme and keeps one shared product search', async () => {
  const view = render(<App />);
  expect(view.container.querySelector('.site-shell').dataset.shopTheme).toBe('light');
  expect(screen.getAllByLabelText('Tìm kiếm sản phẩm')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Tìm kiếm sản phẩm'), { target: { value: 'polo' } });
  fireEvent.click(screen.getByText('TÌM'));
  await waitFor(() => expect(window.location.pathname).toBe('/san-pham'));
  expect(screen.getAllByLabelText('Tìm kiếm sản phẩm')).toHaveLength(1);
  expect(window.location.search).toContain('keyword=polo');
});
it('persists customer dark mode separately from admin', async () => {
  localStorage.setItem('admin-theme', 'light');
  localStorage.setItem('anh-lon-shop-theme', 'light');
  const view = render(<App />);
  fireEvent.click(screen.getByLabelText('Chuyển sang chế độ tối'));
  expect(view.container.querySelector('.site-shell').dataset.shopTheme).toBe('dark');
  expect(localStorage.getItem('anh-lon-shop-theme')).toBe('dark');
  expect(localStorage.getItem('admin-theme')).toBe('light');
  view.unmount();
  const next = render(<App />);
  expect(next.container.querySelector('.site-shell').dataset.shopTheme).toBe('dark');
  fireEvent.click(screen.getByLabelText('Chuyển sang chế độ sáng'));
  expect(localStorage.getItem('anh-lon-shop-theme')).toBe('light');
});
it('clears search keyword and restores focus', async () => {
  render(<App />);
  const input = screen.getByLabelText('Tìm kiếm sản phẩm');
  fireEvent.change(input, { target: { value: 'polo' } });
  fireEvent.click(screen.getByText('TÌM'));
  fireEvent.click(screen.getByLabelText('Xóa từ khóa tìm kiếm'));
  expect(input.value).toBe('');
  expect(document.activeElement).toBe(input);
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('keyword=&'));
});
it('paginates order history and recovers from an API error', async () => {
  api.mockRejectedValueOnce(new Error('Lỗi tải đơn')).mockResolvedValue({
    content: [{ id: 1, orderCode: 123, status: 'CONFIRMED', totalAmount: 100 }],
    totalPages: 2,
  });
  render(<OrdersModal onClose={vi.fn()} onNotice={vi.fn()} />);
  await screen.findByText('Lỗi tải đơn');
  fireEvent.click(screen.getByText('Thử lại'));
  await screen.findByText('Mã đơn #123');
  fireEvent.click(screen.getByText('Trang sau'));
  await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('page=1'))).toBe(true));
});
it('shows PayOS payment status separately from fulfillment status', async () => {
  api.mockResolvedValue({
    content: [
      {
        id: 1,
        orderCode: 123,
        status: 'PENDING',
        paymentMethod: 'PAYOS',
        paymentStatus: 'EXPIRED',
        totalAmount: 100,
        items: [],
      },
    ],
    totalPages: 1,
  });
  render(<OrdersModal onClose={vi.fn()} onNotice={vi.fn()} />);
  await screen.findByText('Mã đơn #123');
  expect(screen.getByText('Chưa thanh toán')).toBeTruthy();
});
it('opens order history as a direct page and requests the selected server-side tab/search', async () => {
  window.history.replaceState({}, '', '/don-hang?tab=TO_PAY&keyword=polo');
  refreshSession.mockResolvedValue({ customer: { id: 7, fullName: 'Khách thử' } });
  api.mockImplementation(async path =>
    path.includes('/api/orders?')
      ? { content: [], totalPages: 0, totalElements: 0 }
      : path.includes('categories')
        ? []
        : { content: [product], totalPages: 1, totalElements: 1 },
  );
  render(<App />);
  await screen.findByRole('heading', { name: 'Đơn hàng của tôi' });
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/api/orders?page=0&size=8&tab=TO_PAY&keyword=polo'),
  );
  expect(document.querySelector('.modal-backdrop')).toBeNull();
});
it('loads a directly opened order detail route without opening a dialog', async () => {
  window.history.replaceState({}, '', '/don-hang/77?tab=RETURN&page=2');
  refreshSession.mockResolvedValue({ customer: { id: 7, fullName: 'Khách thử' } });
  api.mockImplementation(async path =>
    path === '/api/orders/77'
      ? {
          id: 77,
          orderCode: 7077,
          status: 'COMPLETED',
          paymentMethod: 'COD',
          paymentStatus: 'COD',
          totalAmount: 100000,
          createdAt: '2026-09-24T10:00:00Z',
          items: [],
        }
      : path.includes('categories')
        ? []
        : { content: [], totalPages: 0, totalElements: 0 },
  );
  render(<App />);
  await screen.findByText('MÃ ĐƠN #7077');
  expect(api).toHaveBeenCalledWith('/api/orders/77');
  expect(document.querySelector('.modal-backdrop')).toBeNull();
});
it('keeps the cancellation reason after failure and only submits on confirmation', async () => {
  api.mockRejectedValue(new Error('Thử lại sau'));
  render(<OrderView order={{ id: 1, status: 'CONFIRMED', items: [] }} onNotice={vi.fn()} />);
  fireEvent.click(screen.getByText('HỦY ĐƠN'));
  expect(api).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Đổi địa chỉ' } });
  fireEvent.click(screen.getByText('Xác nhận'));
  await screen.findByText('Thử lại sau');
  expect(screen.getByLabelText('Lý do').value).toBe('Đổi địa chỉ');
  expect(api).toHaveBeenCalledWith('/api/orders/1/cancel', {
    method: 'PATCH',
    body: { reason: 'Đổi địa chỉ' },
  });
});
it('blocks duplicate checkout submission and clears the cart as soon as COD succeeds', async () => {
  let finish;
  const saved = {
    id: 1,
    recipientName: 'Khách thử',
    phone: '0912345678',
    addressLine: '12 Đường thử',
    province: 'Thành phố Hà Nội',
    ward: 'Phường Ba Đình',
    defaultAddress: true,
  };
  api.mockImplementation(path =>
    path.includes('addresses')
      ? Promise.resolve([saved])
      : new Promise(resolve => {
          finish = resolve;
        }),
  );
  const placed = vi.fn();
  const { container } = render(
    <CheckoutPage
      cart={{ items: [{ productId: 1, name: 'Áo', quantity: 1, lineTotal: 100 }], subtotal: 100 }}
      onPlaced={placed}
    />,
  );
  await screen.findByText(saved.phone);
  fireEvent.submit(container.querySelector('form'));
  fireEvent.submit(container.querySelector('form'));
  expect(api.mock.calls.filter(([path]) => path === '/api/orders')).toHaveLength(1);
  finish({ order: { orderCode: 456, totalAmount: 100 }, paymentUrl: null });
  await screen.findByText('Đơn hàng #456');
  expect(placed).toHaveBeenCalledTimes(1);
});

it('loads real-client catalog on home and only uses customer endpoints', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Áo kiểm thử' });
  expect(api.mock.calls.every(([path]) => !path.includes('/admin/'))).toBe(true);
});
it('retries catalog after a connection failure', async () => {
  let failed = true;
  api.mockImplementation(async path => {
    if (path.includes('categories')) return [];
    if (failed) throw new Error('Mất kết nối');
    return { content: [product], totalPages: 1 };
  });
  render(<App />);
  await screen.findByText('Chưa kết nối được cửa hàng');
  failed = false;
  fireEvent.click(screen.getByText('THỬ KẾT NỐI LẠI'));
  await screen.findByRole('heading', { name: 'Áo kiểm thử' });
});
it('searches catalog with the entered keyword', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Áo kiểm thử' });
  fireEvent.change(screen.getByLabelText('Tìm kiếm sản phẩm'), { target: { value: 'polo' } });
  fireEvent.click(screen.getByText('TÌM'));
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => path.includes('keyword=polo'))).toBe(true),
  );
});
it('keeps one clear search field for customer catalog search', async () => {
  render(<App />);
  const search = screen.getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' });
  expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  expect(search.placeholder).toBe('Tìm kiếm sản phẩm...');
});
it('restores a direct catalog search and keeps visible card actions', async () => {
  window.history.replaceState({}, '', '/san-pham?keyword=polo');
  render(<App />);
  await screen.findByRole('heading', { name: 'Áo kiểm thử' });
  expect(screen.getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' }).value).toBe('polo');
  expect(api.mock.calls.some(([path]) => path.includes('keyword=polo'))).toBe(true);
  expect(screen.getByRole('button', { name: 'Thêm Áo kiểm thử vào giỏ' })).toBeTruthy();
});
it('shows recoverable session network error without pretending login expired', async () => {
  refreshSession.mockRejectedValueOnce(new Error('Máy chủ tạm ngừng'));
  render(<App />);
  await screen.findByText('Máy chủ tạm ngừng');
  fireEvent.click(screen.getByText('Thử lại'));
  await waitFor(() => expect(screen.queryByText('Máy chủ tạm ngừng')).toBe(null));
});

it('filters catalog using quick price pills', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Áo kiểm thử' });
  fireEvent.click(screen.getByLabelText(/bộ lọc giá/i));
  fireEvent.click(screen.getByRole('button', { name: 'Dưới 300.000₫' }));
  await waitFor(() =>
    expect(api.mock.calls.some(([p]) => p.includes('maxPrice=300000'))).toBe(true),
  );
});

it('opens product modal, views size guide, and handles buy now', async () => {
  api.mockImplementation(async p => {
    if (p.includes('categories')) return ['Áo thun'];
    if (p.includes('feedback')) return [];
    if (p.startsWith('/api/products/')) return product;
    return { content: [product], totalPages: 1, totalElements: 1 };
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Áo kiểm thử' });
  fireEvent.click(screen.getByRole('button', { name: 'Chi tiết Áo kiểm thử' }));
  expect(await screen.findByRole('heading', { name: 'Áo kiểm thử', level: 2 })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /hướng dẫn kích thước/i }));
  expect(await screen.findByRole('heading', { name: 'Bảng Hướng Dẫn Kích Thước' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng kích thước' }));
  expect(screen.queryByRole('heading', { name: 'Bảng Hướng Dẫn Kích Thước' })).toBeNull();
  expect(screen.getByRole('button', { name: 'MUA NGAY' })).toBeTruthy();
});
