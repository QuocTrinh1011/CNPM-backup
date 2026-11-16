// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WarehouseReports from './WarehouseReports';
import { adminApi } from '../../api/manager-api';

vi.mock('../../api/manager-api', async importOriginal => ({ ...(await importOriginal()), adminApi: vi.fn() }));

const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;
const report = {
  period: 'MONTH', year: YEAR, month: MONTH, quarter: null,
  fromInclusive: `${YEAR}-01-31T17:00:00Z`, toExclusive: `${YEAR}-02-28T17:00:00Z`,
  effectiveFromInclusive: '2026-01-31T17:00:00Z', historyAvailableFrom: '2026-01-31T17:00:00Z', historyComplete: true,
  balances: [
    { itemType: 'MATERIAL', itemId: 8, itemCode: 'FABRIC', itemName: 'Vải cotton', unit: 'm', location: 'RAW_MATERIAL_AVAILABLE', scopeId: null, openingQuantity: 10, incomingQuantity: 5, outgoingQuantity: 3, closingQuantity: 12 },
    { itemType: 'MATERIAL', itemId: 8, itemCode: 'FABRIC', itemName: 'Vải cotton', unit: 'm', location: 'PRODUCTION_ALLOCATED', scopeId: 31, openingQuantity: 0, incomingQuantity: 3, outgoingQuantity: 1, closingQuantity: 2 },
    { itemType: 'PRODUCT', itemId: 12, itemCode: 'TEE-12', itemName: 'Áo thun', unit: 'cái', location: 'FINISHED_WAREHOUSE', scopeId: null, openingQuantity: 2, incomingQuantity: 4, outgoingQuantity: 1, closingQuantity: 5 },
    { itemType: 'PRODUCT', itemId: 12, itemCode: 'TEE-12', itemName: 'Áo thun', unit: 'cái', location: 'SELLABLE', scopeId: null, openingQuantity: 5, incomingQuantity: 1, outgoingQuantity: 2, closingQuantity: 4 },
  ],
  movementTotals: [{ itemType: 'PRODUCT', location: 'SELLABLE', movementType: 'SALE', incomingQuantity: 0, outgoingQuantity: 2, netQuantity: -2 }],
};

beforeEach(() => {
  vi.resetAllMocks();
  adminApi.mockResolvedValue(report);
});
afterEach(cleanup);

it('requests a selected month and separates stock balances by warehouse location', async () => {
  render(<WarehouseReports />);
  expect(await screen.findAllByText('Vải cotton')).toHaveLength(2);
  expect(screen.getByLabelText('Loại kỳ').value).toBe('MONTH');
  expect(screen.getByRole('table', { name: 'Nguyên liệu khả dụng' })).toBeTruthy();
  expect(screen.getByRole('table', { name: 'Nguyên liệu đã cấp theo kế hoạch' })).toBeTruthy();
  expect(screen.getByRole('table', { name: 'Thành phẩm trong kho' })).toBeTruthy();
  expect(screen.getByRole('table', { name: 'Sản phẩm sẵn sàng bán' })).toBeTruthy();
  expect(screen.getByText('Kế hoạch #31')).toBeTruthy();
  expect(screen.getByText('10')).toBeTruthy();
  expect(adminApi).toHaveBeenCalledWith(`/api/manager/warehouse/reports?period=MONTH&year=${YEAR}&month=${MONTH}`, expect.anything());

  fireEvent.change(screen.getByLabelText('Loại kỳ'), { target: { value: 'QUARTER' } });
  fireEvent.change(screen.getByLabelText('Quý'), { target: { value: '1' } });
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith(`/api/manager/warehouse/reports?period=QUARTER&year=${YEAR}&quarter=1`, expect.anything()));
});

it('discloses the inventory history cutover and offers retry after a report failure', async () => {
  adminApi.mockRejectedValueOnce(new Error('Tạm thời lỗi truy vấn báo cáo.')).mockResolvedValueOnce({ ...report, historyComplete: false });
  render(<WarehouseReports />);
  expect(await screen.findByText('Tạm thời lỗi truy vấn báo cáo.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText(/Lịch sử kho chỉ được ghi nhận từ/)).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain(new Date(report.historyAvailableFrom).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
});

it('shows an empty state for periods without inventory balances', async () => {
  adminApi.mockResolvedValue({ ...report, balances: [], movementTotals: [] });
  render(<WarehouseReports />);
  expect(await screen.findAllByText('Không có số dư trong kỳ này.')).toHaveLength(4);
});
