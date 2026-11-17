// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WarehouseEmployeeWorkspace from './WarehouseEmployeeWorkspace';
import { adminApi } from '../../api/manager-api';

vi.mock('../../api/manager-api', async importOriginal => ({ ...(await importOriginal()), adminApi: vi.fn() }));

const plan = {
  id: 31, planCode: 'PP-031', productId: 12, productName: 'Áo thun', targetQuantity: 20, completedQuantity: 0,
  status: 'PLANNED', materials: [{ id: 71, materialId: 8, materialCode: 'FABRIC', materialName: 'Vải cotton', unit: 'm', requiredQuantity: 30, allocatedQuantity: 10, consumedQuantity: 0, returnedQuantity: 0 }],
};
beforeEach(() => {
  vi.resetAllMocks();
  adminApi.mockImplementation(async (url, options = {}) => {
    if (options.method === 'POST') return { id: 91, requestCode: 'REQ-091', status: 'PENDING' };
    if (url.includes('/warehouse/me/plans?')) return { content: [plan], totalPages: 1, totalElements: 1 };
    if (url.includes('/warehouse/me/material-requests?')) return { content: [{ id: 1, requestCode: 'MI-001', status: 'PENDING', planCode: 'PP-031', items: [] }] };
    if (url.includes('/warehouse/me/material-returns?')) return { content: [{ id: 2, returnCode: 'MR-002', status: 'APPROVED', planCode: 'PP-031', items: [] }] };
    if (url.includes('/warehouse/me/finished-goods-requests?')) return { content: [{ id: 3, requestCode: 'TP-003', status: 'REJECTED', items: [] }] };
    return {};
  });
});
afterEach(cleanup);

it('loads assigned work and submits material, production, return, and finished-goods requests without employee ids', async () => {
  render(<WarehouseEmployeeWorkspace />);
  expect(await screen.findByRole('button', { name: 'Ghi nhận sản lượng PP-031' })).toBeTruthy();
  expect(screen.getByText('MI-001')).toBeTruthy();
  expect(screen.getByText('MR-002')).toBeTruthy();
  expect(screen.getByText('TP-003')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Đề nghị nguyên liệu PP-031' }));
  fireEvent.change(screen.getByLabelText('Số lượng xin cấp Vải cotton'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị nguyên liệu' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/warehouse/me/material-requests', expect.objectContaining({
    method: 'POST', body: { planId: 31, items: [{ planMaterialId: 71, quantity: 5 }], note: null },
  })));

  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận sản lượng PP-031' }));
  fireEvent.change(screen.getByLabelText('Số lượng hoàn thành'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu sản lượng' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/warehouse/me/plans/31/production-runs', expect.objectContaining({
    method: 'POST', body: { producedQuantity: 5, note: null },
  })));

  fireEvent.click(await screen.findByRole('button', { name: 'Đề nghị trả nguyên liệu PP-031' }));
  fireEvent.change(screen.getByLabelText('Số lượng trả Vải cotton'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị trả nguyên liệu' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/warehouse/me/plans/31/material-returns', expect.objectContaining({
    method: 'POST', body: { items: [{ planMaterialId: 71, quantity: 2 }], note: null },
  })));

  fireEvent.click(await screen.findByRole('button', { name: 'Đề nghị chuyển thành phẩm' }));
  fireEvent.change(screen.getByLabelText('Sản phẩm cần chuyển'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Số lượng chuyển'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị chuyển thành phẩm' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/warehouse/me/finished-goods-requests', expect.objectContaining({
    method: 'POST', body: { items: [{ productId: 12, quantity: 4 }], note: null },
  })));

  expect(adminApi.mock.calls.filter(([, options]) => options?.method === 'POST').every(([, options]) => !Object.hasOwn(options.body, 'employeeId'))).toBe(true);
});

it('validates positive quantities before posting warehouse requests', async () => {
  render(<WarehouseEmployeeWorkspace />);
  await screen.findByRole('button', { name: 'Ghi nhận sản lượng PP-031' });
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận sản lượng PP-031' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu sản lượng' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(adminApi.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});
