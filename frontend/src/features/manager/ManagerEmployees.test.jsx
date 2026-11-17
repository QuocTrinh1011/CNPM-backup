// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ManagerEmployees from './ManagerEmployees';
import { adminApi } from '../../api/manager-api';

vi.mock('../../api/manager-api', async (importOriginal) => ({
  ...(await importOriginal()),
  adminApi: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  adminApi.mockResolvedValue({ content: [], totalPages: 0, totalElements: 0 });
});
afterEach(cleanup);

it('lets HR create an employee account with a self-service profile', async () => {
  adminApi.mockImplementation(async (url) => {
    if (url.includes('/api/manager/employees?')) {
      const query = new URL(url, 'http://localhost').searchParams.get('q');
      if (query === 'Linh') {
      return { content: [{ id: 12, fullName: 'Linh Nguyễn', email: 'linh@example.test', phone: '0900000000', role: 'EMPLOYEE', locked: false }], totalPages: 1, totalElements: 1 };
      }
      return { content: [], totalPages: 0, totalElements: 0 };
    }
    return { id: 12 };
  });

  render(<ManagerEmployees />);
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm nhân viên' }));
  fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Linh Nguyễn' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'linh@example.test' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu tạm thời'), { target: { value: 'Employee123!' } });
  fireEvent.change(screen.getByLabelText('Mã nhân viên'), { target: { value: 'NV-012' } });
  fireEvent.change(screen.getByLabelText('Chức danh'), { target: { value: 'Nhân viên bán hàng' } });
  fireEvent.change(screen.getByLabelText('Ngày nhận việc'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText('Khu vực làm việc'), { target: { value: 'WAREHOUSE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ' }));

  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/employees', expect.objectContaining({
    method: 'POST',
    body: expect.objectContaining({ fullName: 'Linh Nguyễn', email: 'linh@example.test', temporaryPassword: 'Employee123!', employeeCode: 'NV-012', jobTitle: 'Nhân viên bán hàng', workArea: 'WAREHOUSE' }),
  })));
  expect(screen.getByText(/Admin quản lý quyền truy cập hệ thống/)).toBeTruthy();
});

it('lets HR edit an employee profile and confirm deactivation', async () => {
  const employee = { id: 12, fullName: 'Linh Nguyễn', email: 'linh@example.test', phone: '0900000000', employeeCode: 'NV-012', jobTitle: 'Nhân viên', educationLevel: 'Cao đẳng', permissionProfile: 'STAFF', employmentStatus: 'ACTIVE', hireDate: '2026-01-01', monthlyBaseSalary: 9000000, insuranceSalaryBase: 7000000, locked: false };
  adminApi.mockImplementation(async (url, options = {}) => {
    if (url.includes('/api/manager/employees?')) return { content: [employee], totalPages: 1, totalElements: 1 };
    if (options.method === 'DELETE') return undefined;
    return employee;
  });

  render(<ManagerEmployees />);
  await screen.findByText('Linh Nguyễn');
  fireEvent.click(screen.getByRole('button', { name: 'Sửa Linh Nguyễn' }));
  fireEvent.change(screen.getByLabelText('Chức danh'), { target: { value: 'Trưởng ca' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/employees/12', expect.objectContaining({ method: 'PUT', body: expect.objectContaining({ jobTitle: 'Trưởng ca' }) })));
  await screen.findByText('Đã cập nhật hồ sơ nhân viên.');

  fireEvent.click(screen.getByRole('button', { name: 'Ngừng hoạt động Linh Nguyễn' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận ngừng hoạt động' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/employees/12', expect.objectContaining({ method: 'DELETE' })));
});

it('searches employees and renders directory fields', async () => {
  adminApi.mockImplementation(async (url) => {
    const query = new URL(url, 'http://localhost').searchParams.get('q');
    if (query === 'Linh') {
      return { content: [{ id: 12, fullName: 'Linh Nguyễn', email: 'linh@example.test', phone: '0900000000', employeeCode: 'NV-012', jobTitle: 'Nhân viên', employmentStatus: 'ACTIVE', role: 'EMPLOYEE', locked: false }], totalPages: 1, totalElements: 1 };
    }
    return { content: [], totalPages: 0, totalElements: 0 };
  });

  render(<ManagerEmployees />);
  await screen.findByText('Chưa có nhân viên phù hợp.');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm nhân viên' }), { target: { value: 'Linh' } });

  expect(await screen.findByText('Linh Nguyễn')).toBeTruthy();
  expect(screen.getByText('linh@example.test')).toBeTruthy();
  expect(screen.getByText('0900000000')).toBeTruthy();
  expect(screen.getByText('Đang làm việc')).toBeTruthy();
  expect(adminApi.mock.calls.some(([url]) => url.includes('q=Linh'))).toBe(true);
  expect(screen.getByRole('button', { name: 'Thêm nhân viên' })).toBeTruthy();
});

it('requests the next page and cancels the previous request when unmounted', async () => {
  adminApi.mockImplementation(async (url) => {
    const page = new URL(url, 'http://localhost').searchParams.get('page');
    return {
      content: [{ id: Number(page) + 1, fullName: `Employee ${page}`, email: `employee${page}@example.test`, locked: true }],
      totalPages: 2,
      totalElements: 2,
    };
  });
  const view = render(<ManagerEmployees />);
  expect(await screen.findByText('Employee 0')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
  expect(await screen.findByText('Employee 1')).toBeTruthy();
  expect(adminApi.mock.calls.some(([url]) => url.includes('page=1'))).toBe(true);
  view.unmount();
  expect(adminApi.mock.calls.every(([, options]) => options?.signal instanceof AbortSignal)).toBe(true);
});
