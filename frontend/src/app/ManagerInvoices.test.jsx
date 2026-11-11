// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ManagerApp from './ManagerApp';
import { adminApi, adminRefreshSession } from '../api/manager-api';

vi.mock('../api/manager-api', async original => ({ ...await original(), adminApi: vi.fn(), adminRefreshSession: vi.fn() }));

const page = (content = []) => ({ content, totalElements: content.length, totalPages: content.length ? 1 : 0 });
const invoice = {
  id: 1,
  orderCode: 1001,
  status: 'COMPLETED',
  paymentStatus: 'PAID',
  paymentMethod: 'PAYOS',
  returnStatus: 'NONE',
  totalAmount: 900000,
  discountAmount: 100000,
  voucherCode: 'SALE10',
  createdAt: '2026-11-01T03:00:00Z',
  customer: { id: 7, fullName: 'Nguyễn Văn A', email: 'a@test.vn' },
};
const secondInvoice = {
  ...invoice,
  id: 2,
  orderCode: 1002,
  customer: { id: 8, fullName: 'Trần Thị B', email: 'b@test.vn' },
};
const detail = {
  ...invoice,
  deliveryAddress: '12 Lê Lợi, Quận 1',
  trackingCode: 'GHN123',
  items: [{ id: 11, quantity: 2, size: 'M', color: 'Đen', unitPrice: 500000, product: { id: 5, name: 'Áo sơ mi' } }],
};
const secondDetail = { ...detail, ...secondInvoice, deliveryAddress: '8 Nguyễn Huệ' };
const flush = async () => {
  await act(async () => {
    await import('../features/manager/ManagerInvoices');
    await vi.advanceTimersByTimeAsync(0);
  });
};
const listUrl = url => url.startsWith('/api/manager/orders?');

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  adminRefreshSession.mockResolvedValue({ manager: { fullName: 'Manager' } });
  window.history.replaceState({}, '', '/manager/invoices');
  adminApi.mockReset();
  adminApi.mockImplementation(async url => {
    if (url === '/api/manager/orders/1') return detail;
    if (url === '/api/manager/orders/2') return secondDetail;
    if (listUrl(url)) return page([invoice, secondInvoice]);
    if (url === '/api/manager/notifications/summary') return { unreadCount: 0 };
    return page();
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('renders the invoice page and keeps it visible beside a read-only detail panel', async () => {
  render(<ManagerApp />);
  await flush();
  expect(window.location.pathname).toBe('/manager/invoices');
  expect(screen.getByText('#1001')).toBeTruthy();
  expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
  expect(within(screen.getByText('#1001').closest('tr')).getByText(/1\.000\.000/)).toBeTruthy();

  fireEvent.click(within(screen.getByText('#1001').closest('tr')).getByRole('button', { name: 'Xem hóa đơn' }));
  await flush();
  const panel = screen.getByRole('region', { name: 'Chi tiết hóa đơn' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(within(screen.getByText('#1001').closest('tr')).getByRole('button', { name: 'Xem hóa đơn' })).toBeTruthy();
  expect(adminApi.mock.calls.some(([url]) => url === '/api/manager/orders/1')).toBe(true);
  expect(within(panel).getByText('Hóa đơn #1001')).toBeTruthy();
  expect(within(panel).getByText('Áo sơ mi')).toBeTruthy();
  expect(within(panel).getByText('Tạm tính')).toBeTruthy();
  expect(within(panel).getByText('Giảm giá · SALE10')).toBeTruthy();
  expect(within(panel).getByText('Tổng thanh toán')).toBeTruthy();
  expect(within(panel).getByText('Đã thanh toán')).toBeTruthy();
  expect(within(panel).getByText('GHN123')).toBeTruthy();

  fireEvent.click(within(panel).getByRole('button', { name: 'Đóng hóa đơn' }));
  await flush();
  expect(screen.queryByRole('region', { name: 'Chi tiết hóa đơn' })).toBeNull();

  fireEvent.click(within(screen.getByText('#1001').closest('tr')).getByRole('button', { name: 'Xem hóa đơn' }));
  await flush();
  fireEvent.keyDown(screen.getByRole('region', { name: 'Chi tiết hóa đơn' }), { key: 'Escape' });
  await flush();
  expect(screen.queryByRole('region', { name: 'Chi tiết hóa đơn' })).toBeNull();
});

it('sends the customer search to the server and keeps it in the URL', async () => {
  render(<ManagerApp />);
  await flush();
  fireEvent.change(screen.getByLabelText('Thanh toán'), { target: { value: 'PAID' } });
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-01' } });
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-02' } });
  fireEvent.change(screen.getByPlaceholderText('Tìm mã hóa đơn, tên hoặc email khách...'), { target: { value: '0901' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tìm hóa đơn' }));
  await flush();
  const filtersBeforeOpeningPanel = new URLSearchParams(window.location.search);
  expect(filtersBeforeOpeningPanel.get('q')).toBe('0901');
  expect(filtersBeforeOpeningPanel.get('paymentStatus')).toBe('PAID');
  expect(filtersBeforeOpeningPanel.get('fromDate')).toBe('2026-11-01');
  expect(filtersBeforeOpeningPanel.get('toDate')).toBe('2026-11-02');
  expect(adminApi.mock.calls.some(([url]) => listUrl(url) && url.includes('q=0901'))).toBe(true);
  fireEvent.click(within(screen.getByText('#1001').closest('tr')).getByRole('button', { name: 'Xem hóa đơn' }));
  await flush();
  expect(screen.getByRole('region', { name: 'Chi tiết hóa đơn' })).toBeTruthy();
  expect(new URLSearchParams(window.location.search)).toEqual(filtersBeforeOpeningPanel);
  expect(screen.getByPlaceholderText('Tìm mã hóa đơn, tên hoặc email khách...').value).toBe('0901');
  fireEvent.click(screen.getByRole('button', { name: 'Đóng hóa đơn' }));
  await flush();
  expect(new URLSearchParams(window.location.search)).toEqual(filtersBeforeOpeningPanel);
});

it('moves focus when switching invoices and restores it to the latest invoice trigger', async () => {
  render(<ManagerApp />);
  await flush();
  const firstTrigger = within(screen.getByText('#1001').closest('tr')).getByRole('button', { name: 'Xem hóa đơn' });
  const secondTrigger = within(screen.getByText('#1002').closest('tr')).getByRole('button', { name: 'Xem hóa đơn' });

  firstTrigger.focus();
  fireEvent.click(firstTrigger);
  await flush();
  const closeButton = screen.getByRole('button', { name: 'Đóng hóa đơn' });
  expect(document.activeElement).toBe(closeButton);

  secondTrigger.focus();
  fireEvent.click(secondTrigger);
  await flush();
  expect(screen.getByRole('heading', { name: 'Hóa đơn #1002' })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng hóa đơn' }));

  fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  await flush();
  expect(screen.queryByRole('region', { name: 'Chi tiết hóa đơn' })).toBeNull();
  expect(document.activeElement).toBe(secondTrigger);
});

it('shows a retry state when the invoice list cannot load', async () => {
  let failed = false;
  adminApi.mockImplementation(async url => {
    if (listUrl(url) && !failed) { failed = true; throw new Error('Mất kết nối'); }
    if (listUrl(url)) return page([invoice]);
    if (url === '/api/manager/orders/1') return detail;
    if (url === '/api/manager/notifications/summary') return { unreadCount: 0 };
    return page();
  });
  render(<ManagerApp />);
  await flush();
  expect(screen.getByRole('alert').textContent).toContain('Mất kết nối');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await flush();
  expect(screen.getByText('#1001')).toBeTruthy();
});
