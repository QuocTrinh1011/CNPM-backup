// @vitest-environment jsdom
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PaymentQr from '../features/storefront/PaymentQr';
import CustomerVouchers from '../features/customer/CustomerVouchers';
import CustomerPassword from '../features/customer/CustomerPassword';
import { useManagerFilters, vietnamDateRange } from '../shared/hooks/useManagerFilters';
import { api } from '../api/api';
vi.mock('../api/api', async original => ({ ...(await original()), api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
  window.history.replaceState({}, '', '/');
});
it('does not overlap slow QR polling and aborts when leaving', async () => {
  vi.useFakeTimers();
  api.mockReturnValue(new Promise(() => {}));
  const { unmount } = render(<PaymentQr orderId={1} />);
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
  expect(api).toHaveBeenCalledTimes(1);
  const signal = api.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});
it('new QR cannot be overwritten by an old sync response', async () => {
  const expired = { paymentStatus: 'EXPIRED', retryable: true, orderCode: 1 };
  let old;
  api
    .mockResolvedValueOnce(expired)
    .mockReturnValueOnce(
      new Promise(resolve => {
        old = resolve;
      }),
    )
    .mockResolvedValueOnce({
      paymentStatus: 'PENDING',
      qrCode: 'NEWQR',
      orderCode: 2,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
  render(<PaymentQr orderId={1} />);
  await screen.findByText('Mã thanh toán đã hết hạn');
  fireEvent.click(screen.getByLabelText('Cập nhật trạng thái thanh toán'));
  fireEvent.click(screen.getByText('Tạo mã QR mới'));
  await screen.findByTitle('Mã QR thanh toán đơn 2');
  await act(async () => old(expired));
  expect(screen.getByTitle('Mã QR thanh toán đơn 2')).toBeTruthy();
  expect(api.mock.calls[1][1].signal.aborted).toBe(true);
});
it('does not allow selecting vouchers from the previous page while loading', async () => {
  const onSelect = vi.fn();
  api
    .mockResolvedValueOnce({
      content: [
        {
          code: 'OLD',
          state: 'ACTIVE',
          source: 'GENERAL',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minOrderAmount: 100000,
        },
      ],
      totalPages: 2,
    })
    .mockReturnValueOnce(new Promise(() => {}));
  render(<CustomerVouchers onSelect={onSelect} subtotal={50000} />);
  await screen.findByText('OLD');
  expect(screen.getByText(/Cần thêm/)).toBeTruthy();
  fireEvent.click(screen.getByText('Trang sau'));
  await screen.findByText('Đang tải voucher...');
  expect(screen.queryByText('OLD')).toBeNull();
  expect(screen.queryByText('Chọn mã')).toBeNull();
});
it('copies voucher code and reports success', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue() },
  });
  api.mockResolvedValue({ content: [{ code: 'SHOP', state: 'ACTIVE' }], totalPages: 1 });
  render(<CustomerVouchers />);
  fireEvent.click(await screen.findByText('Sao chép mã'));
  await screen.findByText('Đã sao chép SHOP');
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('SHOP');
});
it('disabled public recovery offers support without exposing code or email form', async () => {
  api.mockResolvedValue({ enabled: false });
  render(<CustomerPassword initialMode="forgot" onNavigate={vi.fn()} onNotice={vi.fn()} />);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  expect(screen.getByText(/chưa có kênh gửi mã an toàn/)).toBeTruthy();
  expect(screen.queryByLabelText('Email')).toBeNull();
});
it('persists filters once in StrictMode, resets pagination and restores popstate', () => {
  window.history.replaceState({}, '', '/manager/orders?page=3');
  const push = vi.spyOn(window.history, 'pushState');
  const { result } = renderHook(() => useManagerFilters({ q: '', page: '0' }), {
    wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode>,
  });
  act(() => result.current[1]({ q: 'abc' }));
  expect(result.current[0]).toEqual({ q: 'abc', page: '0' });
  expect(push).toHaveBeenCalledTimes(1);
  act(() => {
    window.history.replaceState({}, '', '/manager/orders?q=xyz&page=2');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current[0]).toEqual({ q: 'xyz', page: '2' });
  push.mockRestore();
  act(() => {
    window.history.replaceState({}, '', '/manager/orders');
    window.dispatchEvent(new Event('manager:navigation'));
  });
  expect(result.current[0]).toEqual({ q: '', page: '0' });
});
it('converts inclusive Vietnam date choices to an exclusive upper bound', () => {
  expect(vietnamDateRange('2026-10-06', '2026-10-06')).toEqual({
    from: '2026-10-05T17:00:00.000Z',
    to: '2026-10-06T17:00:00.000Z',
  });
  expect(vietnamDateRange('2026-99-99', '2026-02-31')).toEqual({ from: undefined, to: undefined });
});
