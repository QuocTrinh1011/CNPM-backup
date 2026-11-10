// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import App, { OrdersPage } from './App';
import { api, refreshSession, signIn } from '../api/api';
import { safeReturn } from './routing/customer-routing';
vi.mock('../api/api', async original => ({ ...(await original()), api: vi.fn(), refreshSession: vi.fn(), signIn: vi.fn() }));
const customer = { id: 19, fullName: 'Khách kiểm thử', email: 'customer@example.com' };
const product = { id: 4, name: 'Polo kiểm thử', stock: 8, price: 200000, sizes: 'M,L', colors: 'Đen', imageUrl: '/test.png' };
const survey = { id: 7, title: 'Gu của bạn', questions: [{ id: 9, text: 'Màu yêu thích', type: 'SINGLE_CHOICE', required: true, optionsJson: '["Đen","Trắng"]' }] };
const respond = async path => {
  if (path === '/api/products/categories') return [];
  if (path === '/api/products/4') return product;
  if (path.endsWith('/feedback')) return [];
  if (path.startsWith('/api/products?')) return { content: [product], totalPages: 1, totalElements: 1 };
  if (path === '/api/cart') return { items: [], subtotal: 0, itemCount: 0 };
  if (path === '/api/wishlist' || path.endsWith('/addresses')) return [];
  if (path === '/api/notifications') return { items: [], unreadCount: 0 };
  if (path === '/api/surveys/7') return survey;
  if (path === '/api/surveys/mine' || path === '/api/surveys') return [survey];
  if (path.startsWith('/api/orders?')) return { content: [], totalPages: 0, totalElements: 0 };
  if (path.startsWith('/api/support-tickets?')) return {content:[],totalPages:0,totalElements:0};
  return {};
};
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); window.history.replaceState({}, '', '/'); window.scrollTo = vi.fn(); refreshSession.mockResolvedValue({ customer }); api.mockImplementation(respond); signIn.mockResolvedValue({ customer }); });
afterEach(cleanup);

it('clears old counts and ignores a late response after changing order tabs', async () => {
  let finishCancelled;
  api.mockImplementation(path => {
    const tab = new URL(path, 'http://test').searchParams.get('tab');
    if (tab === 'CANCELLED') return new Promise(resolve => { finishCancelled = resolve; });
    return Promise.resolve({ content: [], totalElements: tab === 'ALL' ? 23 : 0, totalPages: tab === 'ALL' ? 3 : 0 });
  });
  render(<OrdersPage/>);
  await screen.findByText('23 đơn hàng');
  fireEvent.click(screen.getByRole('button', { name: 'Đã hủy' }));
  await screen.findByText('Đang tải đơn hàng...');
  expect(screen.queryByText('23 đơn hàng')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Chờ xác nhận' }));
  await screen.findByText('0 đơn hàng');
  finishCancelled({ content: [{ id: 777, orderCode: 'STALE', status: 'CANCELLED' }], totalElements: 1, totalPages: 1 });
  await waitFor(() => expect(screen.queryByText('Mã đơn #STALE')).toBeNull());
  expect(api.mock.calls.some(([path]) => path.includes('tab=CANCELLED') && path.includes('page=0'))).toBe(true);
});

it.each([
  ['/tai-khoan', 'Khách kiểm thử'], ['/tai-khoan/dia-chi', 'Địa chỉ của tôi'],
  ['/tai-khoan/doi-mat-khau', 'Đổi mật khẩu'], ['/yeu-thich', 'Món đồ bạn thích.'],
  ['/thong-bao', 'Thông báo'], ['/khao-sat/7', 'Gu của bạn'], ['/don-hang', 'Đơn hàng của tôi'],
  ['/ho-tro', 'Yêu cầu hỗ trợ của tôi'],
])('opens %s directly as a page with the shared account menu', async (path, heading) => {
  window.history.replaceState({}, '', path); render(<App/>);
  await screen.findByRole('heading', { name: heading });
  expect(screen.getByRole('navigation', { name: 'Chức năng tài khoản' })).toBeTruthy();
  expect(document.querySelector('.modal-backdrop,.drawer-backdrop')).toBeNull();
  expect(api.mock.calls.every(([url]) => !url.startsWith('/api/admin'))).toBe(true);
});

it('returns to the protected URL after login without losing its query', async () => {
  refreshSession.mockResolvedValue(null);
  window.history.replaceState({}, '', '/don-hang?tab=TO_PAY&page=2'); render(<App/>);
  await screen.findByRole('heading', { name: 'Chào mừng trở lại.' });
  expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/don-hang?tab=TO_PAY&page=2');
  fireEvent.change(screen.getByLabelText('EMAIL'), { target: { value: customer.email } });
  fireEvent.change(screen.getByLabelText('MẬT KHẨU'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'ĐĂNG NHẬP →' }));
  await screen.findByRole('heading', { name: 'Đơn hàng của tôi' });
  expect(window.location.pathname).toBe('/don-hang');
  expect(api.mock.calls.some(([url]) => url.includes('tab=TO_PAY') && url.includes('page=2'))).toBe(true);
});

it('keeps a session network failure recoverable on a protected page', async () => {
  refreshSession.mockRejectedValueOnce(new Error('Không kết nối được tài khoản'));
  window.history.replaceState({}, '', '/tai-khoan'); render(<App/>);
  await screen.findByText('Không kết nối được tài khoản');
  expect(window.location.pathname).toBe('/tai-khoan');
  refreshSession.mockResolvedValue({ customer }); fireEvent.click(screen.getByText('Thử lại'));
  await screen.findByRole('heading', { name: customer.fullName });
});

it('changes account pages with the sidebar and restores them on popstate', async () => {
  window.history.replaceState({}, '', '/tai-khoan'); render(<App/>);
  await screen.findByRole('heading', { name: customer.fullName });
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Chức năng tài khoản' })).getByRole('link', { name: 'Địa chỉ' }));
  await screen.findByRole('heading', { name: 'Địa chỉ của tôi' });
  window.history.back();
  await screen.findByRole('heading', { name: customer.fullName });
  window.history.forward();
  await screen.findByRole('heading', { name: 'Địa chỉ của tôi' });
});

it('keeps the product page open when adding to the guest cart', async () => {
  refreshSession.mockResolvedValue(null);
  window.history.replaceState({}, '', '/san-pham/4'); render(<App/>);
  await screen.findByRole('heading', { name: product.name });
  fireEvent.click(screen.getByRole('button', { name: /THÊM 1 VÀO GIỎ/ }));
  await screen.findByText('Đã thêm sản phẩm vào giỏ tạm. Đăng nhập khi thanh toán nhé.');
  expect(window.location.pathname).toBe('/san-pham/4');
  fireEvent.click(screen.getByRole('button', { name: 'Xem giỏ hàng' }));
  await screen.findByRole('heading', { name: '1 sản phẩm' });
  expect(window.location.pathname).toBe('/gio-hang');
  expect(document.querySelector('.modal-backdrop,.drawer-backdrop')).toBeNull();
});

it('does not render wishlist fetch errors as an empty wishlist', async () => {
  let fail = true;
  api.mockImplementation(path => { if (path === '/api/wishlist' && fail) return Promise.reject(new Error('Lỗi tải yêu thích')); return respond(path); });
  window.history.replaceState({}, '', '/yeu-thich'); render(<App/>);
  await screen.findByText('Lỗi tải yêu thích'); fail = false;
  fireEvent.click(screen.getByText('Thử lại'));
  await screen.findByText('Chưa có món đồ yêu thích');
});

it('shows the completed state when a survey is opened by URL', async () => {
  api.mockImplementation(path => path === '/api/surveys/mine' ? Promise.resolve([{ ...survey, completed: true }]) : respond(path));
  window.history.replaceState({}, '', '/khao-sat/7'); render(<App/>);
  await screen.findByText(/Bạn đã hoàn thành khảo sát này/);
  expect(screen.getByRole('button', { name: /GỬI CÂU TRẢ LỜI/ }).disabled).toBe(true);
});

it('rejects external or authentication return destinations', () => {
  for (const path of ['https://other.test', '//other.test', '/\\other.test', '/admin', '/dang-nhap']) expect(safeReturn(path)).toBe('/');
  expect(safeReturn('/san-pham/4?x=1')).toBe('/san-pham/4?x=1');
});

it('renders a not-found page without showing the storefront catalog', async () => {
  window.history.replaceState({}, '', '/not-a-route'); render(<App/>);
  await screen.findByText('Không tìm thấy trang');
  expect(document.querySelector('#catalog')).toBeNull();
});
