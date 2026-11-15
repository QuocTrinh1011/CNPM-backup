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

it('searches the read-only employee directory and renders only directory fields', async () => {
  adminApi.mockImplementation(async (url) => {
    const query = new URL(url, 'http://localhost').searchParams.get('q');
    if (query === 'Linh') {
      return { content: [{ id: 12, fullName: 'Linh Nguyễn', email: 'linh@example.test', phone: '0900000000', role: 'EMPLOYEE', locked: false }], totalPages: 1, totalElements: 1 };
    }
    return { content: [], totalPages: 0, totalElements: 0 };
  });

  render(<ManagerEmployees />);
  await screen.findByText('Chưa có nhân viên phù hợp.');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm nhân viên' }), { target: { value: 'Linh' } });

  expect(await screen.findByText('Linh Nguyễn')).toBeTruthy();
  expect(screen.getByText('linh@example.test')).toBeTruthy();
  expect(screen.getByText('0900000000')).toBeTruthy();
  expect(screen.getByText('Hoạt động')).toBeTruthy();
  expect(adminApi.mock.calls.some(([url]) => url.includes('q=Linh'))).toBe(true);
  expect(screen.queryByRole('button', { name: /Thêm|Sửa|Khóa|Xóa/ })).toBeNull();
  expect(screen.queryByRole('link', { name: /Thêm|Sửa|Khóa|Xóa/ })).toBeNull();
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
