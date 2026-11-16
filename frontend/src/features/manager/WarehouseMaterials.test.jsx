// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WarehouseMaterials from './WarehouseMaterials';
import { adminApi } from '../../api/manager-api';

vi.mock('../../api/manager-api', async importOriginal => ({ ...(await importOriginal()), adminApi: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  adminApi.mockImplementation(async url => {
    if (url.includes('/raw-materials')) return [{ id: 1, code: 'FABRIC-COTTON', name: 'Vải cotton', unit: 'm', availableQuantity: 20, active: true }];
    if (url.includes('/suppliers')) return { content: [{ id: 9, code: 'NCC-09', name: 'Vải Việt' }] };
    if (url.includes('/raw-material-receipts')) return { content: [], totalPages: 0, totalElements: 0 };
    return {};
  });
});
afterEach(cleanup);

it('creates a raw material and submits a validated receipt', async () => {
  render(<WarehouseMaterials />);
  expect(await screen.findByText('Vải cotton')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Mã nguyên liệu'), { target: { value: 'THREAD-BLACK' } });
  fireEvent.change(screen.getByLabelText('Tên nguyên liệu'), { target: { value: 'Chỉ đen' } });
  fireEvent.change(screen.getByLabelText('Đơn vị tính'), { target: { value: 'cuộn' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nguyên liệu' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/raw-materials', expect.objectContaining({
    method: 'POST', body: { code: 'THREAD-BLACK', name: 'Chỉ đen', unit: 'cuộn' },
  })));

  const receiptTab = screen.getByRole('tab', { name: 'Phiếu nhập nguyên liệu' });
  fireEvent.click(receiptTab);
  await waitFor(() => expect(receiptTab.getAttribute('aria-selected')).toBe('true'));
  await screen.findByRole('heading', { name: 'Tạo phiếu nhập nguyên liệu' });
  fireEvent.change(screen.getByLabelText('Nhà cung cấp'), { target: { value: '9' } });
  fireEvent.change(screen.getByLabelText('Nguyên liệu'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Số lượng nhập'), { target: { value: '12.5' } });
  fireEvent.change(screen.getByLabelText('Đơn giá nhập'), { target: { value: '20000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhập nguyên liệu' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/raw-material-receipts', expect.objectContaining({
    method: 'POST', body: expect.objectContaining({ supplierId: 9, items: [{ materialId: 1, quantity: 12.5, unitCost: 20000 }] }),
  })));
});

it('blocks an invalid receipt before sending it to the server', async () => {
  render(<WarehouseMaterials />);
  await screen.findByText('Vải cotton');
  const receiptTab = screen.getByRole('tab', { name: 'Phiếu nhập nguyên liệu' });
  fireEvent.click(receiptTab);
  await waitFor(() => expect(receiptTab.getAttribute('aria-selected')).toBe('true'));
  await screen.findByRole('heading', { name: 'Tạo phiếu nhập nguyên liệu' });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhập nguyên liệu' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(adminApi.mock.calls.some(([url, options]) => url === '/api/manager/raw-material-receipts' && options?.method === 'POST')).toBe(false);
});
