// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WarehouseProductionPlans from './WarehouseProductionPlans';
import { adminApi } from '../../api/manager-api';

vi.mock('../../api/manager-api', async importOriginal => ({ ...(await importOriginal()), adminApi: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  adminApi.mockImplementation(async url => {
    if (url.includes('/production-plans')) return { content: [], totalPages: 0, totalElements: 0 };
    if (url.includes('/products?')) return { content: [{ id: 3, name: 'Áo thun' }], totalPages: 1 };
    if (url === '/api/manager/warehouse/employees') return [{ id: 22, fullName: 'Nhân viên kho', employeeCode: 'NV-22' }];
    if (url.includes('/employees?')) return { content: [{ id: 22, fullName: 'Nhân viên kho', employeeCode: 'NV-22', workArea: 'WAREHOUSE', employmentStatus: 'ACTIVE', locked: false }, { id: 23, fullName: 'Nhân viên sales', employeeCode: 'NV-23', workArea: 'SALES', employmentStatus: 'ACTIVE', locked: false }], totalPages: 1 };
    return {};
  });
});
afterEach(cleanup);

it('assigns a production plan only to an active warehouse employee', async () => {
  render(<WarehouseProductionPlans />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo kế hoạch sản xuất' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/warehouse/employees', expect.any(Object)));
  fireEvent.change(await screen.findByLabelText('Sản phẩm'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Số lượng cần sản xuất'), { target: { value: '40' } });
  const employeePicker = screen.getByLabelText('Nhân viên kho phụ trách');
  expect([...employeePicker.options].some(option => option.textContent.includes('Nhân viên kho'))).toBe(true);
  expect([...employeePicker.options].some(option => option.textContent.includes('Nhân viên sales'))).toBe(false);
  fireEvent.change(employeePicker, { target: { value: '22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/production-plans', expect.objectContaining({
    method: 'POST', body: expect.objectContaining({ productId: 3, targetQuantity: 40, assignedEmployeeId: 22 }),
  })));
});
