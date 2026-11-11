// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import CashflowReport from './CashflowReport';
import { adminApi } from '../../api/manager-api';
vi.mock('../../api/manager-api', () => ({ adminApi: vi.fn() }));
const report = {
  collected: 100000,
  refunded: 130000,
  net: -30000,
  collectedOrders: 1,
  unknownMilestone: { orders: 2, amount: 50000 },
  series: [
    { period: '2026-10-01', collected: 100000, refunded: 130000, net: -30000, collectedOrders: 1 },
  ],
  topProducts: [{ productId: 1, name: 'Áo thử', quantity: 2, grossItemValue: 150000 }],
  updatedAt: '2026-10-01T00:00:00Z',
};
const flush = async () => {
  await act(async () => {});
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  adminApi.mockReset();
  adminApi.mockResolvedValue(report);
  window.history.replaceState(
    {},
    '',
    '/manager/reports?tab=cashflow&fromDate=2026-10-01&toDate=2026-10-02&groupBy=day',
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('shows cashflow definitions, negative net and unknown legacy separately', async () => {
  render(<CashflowReport />);
  await flush();
  expect(screen.getByText('Thu ròng trong kỳ')).toBeTruthy();
  expect(screen.getAllByText(/-30\.000/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Dữ liệu cũ chưa xác định mốc/)).toBeTruthy();
  expect(screen.getByText(/Không phải doanh thu ròng sản phẩm/)).toBeTruthy();
  const url = new URL(adminApi.mock.calls[0][0], 'http://local');
  expect(url.searchParams.get('from')).toBe('2026-09-30T17:00:00.000Z');
  expect(url.searchParams.get('to')).toBe('2026-10-02T17:00:00.000Z');
});
it('keeps tab and filters in URL, changes grouping and restores back navigation', async () => {
  render(<CashflowReport />);
  await flush();
  fireEvent.change(screen.getByLabelText('Nhóm theo'), { target: { value: 'month' } });
  await flush();
  expect(window.location.search).toContain('tab=cashflow');
  expect(window.location.search).toContain('groupBy=month');
  window.history.replaceState(
    {},
    '',
    '/manager/reports?tab=cashflow&fromDate=2026-09-01&toDate=2026-09-30&groupBy=day',
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
  await flush();
  expect(screen.getByLabelText('Từ ngày').value).toBe('2026-09-01');
  expect(screen.getByLabelText('Nhóm theo').value).toBe('day');
});
it('polls without replacing good data on error and pauses hidden tabs', async () => {
  const view = render(<CashflowReport />);
  await flush();
  adminApi.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole('alert').textContent).toContain('số liệu gần nhất');
  expect(screen.getByText('Áo thử')).toBeTruthy();
  fireEvent.click(screen.getByText('Thử lại'));
  await flush();
  expect(screen.queryByRole('alert')).toBeNull();
  const count = adminApi.mock.calls.length;
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  await act(async () => vi.advanceTimersByTimeAsync(10000));
  expect(adminApi).toHaveBeenCalledTimes(count);
  view.unmount();
});
it('does not send invalid date ranges or overlapping slow requests', async () => {
  let finish;
  adminApi.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  render(<CashflowReport />);
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(adminApi).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2027-01-01' } });
  await flush();
  expect(screen.getByRole('alert').textContent).toContain('366');
  await act(async () => finish(report));
  expect(screen.queryByText('Áo thử')).toBeNull();
  expect(adminApi).toHaveBeenCalledTimes(1);
});
