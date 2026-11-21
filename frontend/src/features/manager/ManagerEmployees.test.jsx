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
  expect(screen.getByRole('cell', { name: 'Đang làm việc' })).toBeTruthy();
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

it('defaults to active employees and resets pagination when status changes', async () => {
  adminApi.mockImplementation(async url => {
    const params = new URL(url, 'http://localhost').searchParams;
    return params.has('permissionProfile')
      ? { content: [], totalPages: 0, totalElements: 0 }
      : { content: [], totalPages: 2, totalElements: 30 };
  });

  render(<ManagerEmployees />);
  await screen.findByText('Chưa có nhân viên phù hợp.');
  const directoryCalls = () => adminApi.mock.calls
    .map(([url]) => new URL(url, 'http://localhost').searchParams)
    .filter(params => !params.has('permissionProfile'));
  expect(directoryCalls().some(params => params.get('status') === 'ACTIVE' && params.get('page') === '0')).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
  await waitFor(() => expect(directoryCalls().some(params => params.get('status') === 'ACTIVE' && params.get('page') === '1')).toBe(true));
  fireEvent.change(screen.getByLabelText('Tình trạng nhân viên'), { target: { value: 'INACTIVE' } });
  await waitFor(() => expect(directoryCalls().some(params => params.get('status') === 'INACTIVE' && params.get('page') === '0')).toBe(true));
  fireEvent.change(screen.getByLabelText('Tình trạng nhân viên'), { target: { value: 'ALL' } });
  await waitFor(() => expect(directoryCalls().some(params => params.get('status') === 'ALL' && params.get('page') === '0')).toBe(true));
});

it('loads active team leads for reporting lines and explains role access', async () => {
  adminApi.mockImplementation(async url => {
    const params = new URL(url, 'http://localhost').searchParams;
    if (params.get('permissionProfile') === 'TEAM_LEAD') {
      return { content: [{ id: 42, fullName: 'Bảo An', employeeCode: 'TL-42', permissionProfile: 'TEAM_LEAD' }], totalPages: 1, totalElements: 1 };
    }
    return { content: [], totalPages: 0, totalElements: 0 };
  });

  render(<ManagerEmployees />);
  await screen.findByText('Chưa có nhân viên phù hợp.');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

  const leadSelect = screen.getByLabelText('Trưởng nhóm trực tiếp');
  expect(screen.getByRole('option', { name: /Bảo An · TL-42/ })).toBeTruthy();
  fireEvent.change(leadSelect, { target: { value: '42' } });
  expect(leadSelect.value).toBe('42');
  const guidance = screen.getByLabelText('Giải thích quyền nhân sự').textContent;
  expect(guidance).toMatch(/Nhân viên \(STAFF\): tự phục vụ/);
  expect(guidance).toMatch(/Trưởng nhóm \(TEAM_LEAD\): xem hồ sơ nhóm trực tiếp/);
  expect(guidance).toMatch(/Khu vực Kho: cấp quyền tác vụ kho, không cấp quyền duyệt phiếu/);
  expect(adminApi.mock.calls.some(([url]) => {
    const params = new URL(url, 'http://localhost').searchParams;
    return params.get('status') === 'ACTIVE' && params.get('permissionProfile') === 'TEAM_LEAD';
  })).toBe(true);
});

it('shows archived employees in inactive results without unusable actions', async () => {
  const archived = { id: 55, fullName: 'Mai đã lưu trữ', email: 'mai@example.test', employeeCode: 'NV-055', jobTitle: 'Nhân viên', employmentStatus: 'TERMINATED', locked: true, archived: true };
  adminApi.mockImplementation(async url => {
    const params = new URL(url, 'http://localhost').searchParams;
    if (params.has('permissionProfile')) return { content: [], totalPages: 0, totalElements: 0 };
    return params.get('status') === 'INACTIVE'
      ? { content: [archived], totalPages: 1, totalElements: 1 }
      : { content: [], totalPages: 0, totalElements: 0 };
  });

  render(<ManagerEmployees />);
  await screen.findByText('Chưa có nhân viên phù hợp.');
  fireEvent.change(screen.getByLabelText('Tình trạng nhân viên'), { target: { value: 'INACTIVE' } });

  expect(await screen.findByText('Mai đã lưu trữ')).toBeTruthy();
  expect(screen.getByText('Đã lưu trữ')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Sửa Mai đã lưu trữ' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Ngừng hoạt động Mai đã lưu trữ' })).toBeNull();
});
