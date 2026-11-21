// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EmployeeAttendancePage, EmployeeLeaveRequests, EmployeePayrollPage, EmployeeReportPage, EmployeeSelfProfile } from './EmployeeWorkspaces';
import { adminApi } from '../../api/manager-api';

vi.mock('../../api/manager-api', async importOriginal => ({
  ...(await importOriginal()),
  adminApi: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

it('loads the employee profile and saves editable contact details only', async () => {
  const profile = { id: 12, fullName: 'Linh Nguyễn', employeeCode: 'NV-012', jobTitle: 'Nhân viên', phone: '0900000000', emergencyContactName: 'Minh', emergencyContactPhone: '0911111111', emergencyContactRelationship: 'Anh trai', monthlyBaseSalary: 9000000 };
  adminApi.mockImplementation(async (_url, options = {}) => options.method === 'PUT' ? profile : profile);

  render(<EmployeeSelfProfile />);
  expect(await screen.findByText(/Linh Nguyễn/)).toBeTruthy();
  fireEvent.change(await screen.findByLabelText('Điện thoại'), { target: { value: '0988888888' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));

  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/me/profile', expect.objectContaining({
    method: 'PUT', body: expect.objectContaining({ phone: '0988888888', emergencyContactName: 'Minh' }),
  })));
  expect(adminApi.mock.calls[1][1].body).not.toHaveProperty('monthlyBaseSalary');
});

it('lets an employee edit their own full name and contact details', async () => {
  let profile = { id: 12, fullName: 'Linh Nguyễn', employeeCode: 'NV-012', jobTitle: 'Nhân viên', phone: '0900000000', emergencyContactName: 'Minh', emergencyContactPhone: '0911111111', emergencyContactRelationship: 'Anh trai', monthlyBaseSalary: 9000000 };
  adminApi.mockImplementation(async (_url, options = {}) => {
    if (options.method === 'PUT') profile = { ...profile, ...options.body };
    return profile;
  });

  render(<EmployeeSelfProfile />);
  fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Linh Trần' } });
  fireEvent.change(screen.getByLabelText('Điện thoại'), { target: { value: '0988888888' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));

  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/me/profile', expect.objectContaining({
    method: 'PUT', body: expect.objectContaining({ fullName: 'Linh Trần', phone: '0988888888', emergencyContactName: 'Minh' }),
  })));
  const status = await screen.findByRole('status');
  expect(status.textContent).toContain('Đã cập nhật thông tin cá nhân.');
});

it('submits an employee leave request through the self-service endpoint', async () => {
  adminApi.mockImplementation(async (url, options = {}) => {
    if (options.method === 'POST') return { id: 27, requestType: 'SICK', status: 'PENDING' };
    return { content: [], totalPages: 0, totalElements: 0 };
  });

  render(<EmployeeLeaveRequests />);
  fireEvent.change(screen.getByLabelText('Loại đơn'), { target: { value: 'SICK' } });
  fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Xin nghỉ ốm một ngày' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đơn' }));

  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/me/leave-requests', expect.objectContaining({
    method: 'POST', body: expect.objectContaining({ requestType: 'SICK', employeeNote: 'Xin nghỉ ốm một ngày' }),
  })));
  expect((await screen.findByRole('status')).textContent).toContain('Đã lưu thay đổi.');
});

it('lets HR approve a pending leave request', async () => {
  adminApi.mockImplementation(async (_url, options = {}) => options.method === 'PATCH'
    ? { id: 27, status: 'APPROVED' }
    : { content: [{ id: 27, employeeId: 12, employeeCode: 'NV-012', employeeName: 'Linh Nguyễn', requestType: 'ANNUAL', startDate: '2026-03-02', endDate: '2026-03-03', status: 'PENDING' }] });

  render(<EmployeeLeaveRequests hr />);
  expect(await screen.findByText('Linh Nguyễn')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));

  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/hr/leave-requests/27/decision', expect.objectContaining({
    method: 'PATCH', body: expect.objectContaining({ decision: 'APPROVED' }),
  })));
});

it('lets HR record attendance with numeric API values', async () => {
  adminApi.mockImplementation(async (url, options = {}) => {
    if (options.method === 'PUT') return { id: 1 };
    if (url.startsWith('/api/manager/employees?')) return { content: [{ id: 12, employeeCode: 'NV-012', fullName: 'Linh Nguyễn' }] };
    return [];
  });

  render(<EmployeeAttendancePage hr />);
  const employeePicker = (await screen.findAllByRole('combobox')).find(select => select.required);
  fireEvent.change(employeePicker, { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Tăng ca đêm ngày nghỉ'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu chấm công' }));

  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/hr/attendance', expect.objectContaining({
    method: 'PUT', body: expect.objectContaining({ employeeId: 12, dayFraction: 1, overtimeNormalHours: 0, overtimeNightRestDayHours: 2 }),
  })));
});

it('keeps payroll review and publication as separate HR actions', async () => {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  let status = 'DRAFT';
  adminApi.mockImplementation(async (url, options = {}) => {
    if (options.method === 'POST' && url.endsWith('/review')) { status = 'REVIEWED'; return {}; }
    if (options.method === 'POST' && url.endsWith('/publish')) { status = 'PUBLISHED'; return {}; }
    if (url.includes('/payroll-periods?')) return [{ year, month, status }];
    if (/\/payroll-periods\/\d+\/\d+$/.test(url)) return { year, month, status, payslips: [] };
    if (url.includes('/payroll-settings')) return { settingValue: { workingWeekdays: [1, 2, 3, 4, 5] } };
    return {};
  });

  render(<EmployeePayrollPage hr />);
  fireEvent.click(await screen.findByRole('button', { name: 'Duyệt kỳ lương' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Công bố phiếu lương' }));

  await waitFor(() => expect(adminApi).toHaveBeenCalledWith(`/api/manager/hr/payroll-periods/${year}/${month}/publish`, expect.objectContaining({ method: 'POST' })));
});

it('keeps payroll hooks stable when changing from employee view to HR view', () => {
  adminApi.mockResolvedValue({});
  const { rerender } = render(<EmployeePayrollPage />);

  expect(() => rerender(<EmployeePayrollPage hr />)).not.toThrow();
});

it('offers the 2026 payroll rules preset without saving it automatically', async () => {
  adminApi.mockImplementation(async url => {
    if (url.includes('/payroll-settings')) throw new Error('Chưa có PAYROLL_RULES');
    if (url.includes('/payroll-periods?')) return [];
    if (/\/payroll-periods\/\d+\/\d+$/.test(url)) return null;
    return [];
  });

  render(<EmployeePayrollPage hr />);
  const rulesInput = screen.getByLabelText('Quy tắc PAYROLL_RULES (JSON)');
  expect(JSON.parse(rulesInput.value).employeeInsuranceRate).toBe(0.105);
  fireEvent.click(await screen.findByRole('button', { name: 'Dùng cấu hình đề xuất 2026' }));

  const rules = JSON.parse(rulesInput.value);
  expect(rules.employeeInsuranceRate).toBe(0.105);
  expect(rules.employerContributionRate).toBe(0.215);
  expect(rules.personalTaxAllowance).toBe(15500000);
  expect(rules.dependentTaxAllowance).toBe(6200000);
  expect(rules.taxBrackets).toEqual([
    { lowerBound: 0, upperBound: 10000000, rate: 0.05 },
    { lowerBound: 10000000, upperBound: 30000000, rate: 0.1 },
    { lowerBound: 30000000, upperBound: 60000000, rate: 0.2 },
    { lowerBound: 60000000, upperBound: 100000000, rate: 0.3 },
    { lowerBound: 100000000, upperBound: null, rate: 0.35 },
  ]);
  expect(adminApi).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'PUT' }));
});

it('renders the workforce report counts and salary basis supplied by HR reports', async () => {
  adminApi.mockResolvedValue({
    summary: { totalEmployees: 1, activeCount: 1, onApprovedLeaveCount: 0, resignedInPeriodCount: 0, terminatedInPeriodCount: 0 },
    educationSummary: [{ educationLevel: 'Cao đẳng', employeeCount: 1 }],
    salarySummary: { basis: 'CURRENT_PROFILE', totalMonthlyBaseSalary: 9000000, averageMonthlyBaseSalary: 9000000, minimumMonthlyBaseSalary: 9000000, maximumMonthlyBaseSalary: 9000000 },
    tenureSummary: { averageTenureMonths: 12, maximumTenureMonths: 12 },
    employees: [{ employeeId: 12, employeeCode: 'NV-012', fullName: 'Linh Nguyễn', jobTitle: 'Nhân viên', employmentStatus: 'ACTIVE', approvedLeaveTypes: [], educationLevel: 'Cao đẳng', monthlyBaseSalary: 9000000, salaryBasis: 'CURRENT_PROFILE', tenureMonths: 12 }],
  });

  render(<EmployeeReportPage />);

  expect(await screen.findByText(/Linh Nguyễn/)).toBeTruthy();
  expect(screen.getAllByText('Đang làm việc').length).toBeGreaterThan(0);
  expect(screen.getAllByText('CURRENT_PROFILE').length).toBeGreaterThan(0);
});

it('lists only published employee payslips and can print them', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  adminApi.mockResolvedValue([{ id: 9, year: 2026, month: 3, revision: 1, status: 'PUBLISHED', employeeCode: 'NV-012', grossEarnings: 10000000, separateBenefits: 0, employeeDeductions: 800000, takeHomePay: 9200000, lines: [{ id: 1, description: 'Lương cơ bản', lineType: 'EARNING', amount: 10000000 }], uncollectedDeductions: 0 }]);

  render(<EmployeePayrollPage />);
  expect(await screen.findByText('2026/03 · Phiếu lương #1')).toBeTruthy();
  expect(screen.getByText('Lương cơ bản')).toBeTruthy();
  expect(screen.getByText('Tổng thực nhận năm')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'In phiếu tháng' }));
  await waitFor(() => expect(print).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'In bảng lương năm 2026' }));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
});
