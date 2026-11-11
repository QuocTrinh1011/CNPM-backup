// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, afterEach, it, vi, expect } from 'vitest';
import ManagerApp from './ManagerApp';
import { careDeadline } from './CustomerCare';
import { adminApi, adminRefreshSession } from '../../api/manager-api';
vi.mock('../../api/manager-api', async original => ({
  ...(await original()),
  adminApi: vi.fn(),
  adminRefreshSession: vi.fn(),
}));
const customer = { id: 7, fullName: 'Khách A', email: 'customer@test.vn' };
const staff = { id: 3, fullName: 'Quản lý B', email: 'staff@test.vn' };
const task = {
  id: 8,
  customerId: 7,
  customerName: 'Khách A',
  assigneeId: 3,
  assigneeName: 'Quản lý B',
  assigneeActive: true,
  title: 'Gọi chăm sóc',
  description: 'Hỏi trải nghiệm',
  status: 'TODO',
  overdue: true,
  dueAt: '2026-01-01T10:00:00Z',
  createdAt: '2026-01-01T09:00:00Z',
  updatedAt: '2026-01-01T09:00:00Z',
  version: 0,
};
const page = content => ({
  content,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
});
const flush = async () =>
  act(async () => {
    await import('./CustomerCare');
    await import('./CustomerProfile');
    await vi.advanceTimersByTimeAsync(0);
  });
const response = async (url, options) => {
  if (options?.method) return task;
  if (url.includes('/care/staff')) return page([staff]);
  if (url.endsWith('/profile'))
    return {
      customer,
      summary: {
        totalOrders: 0,
        completedOrders: 0,
        completedValue: 0,
        cancelledOrders: 0,
        returnOrders: 0,
      },
    };
  if (url.includes('/care/notes'))
    return page([
      { id: 1, content: 'Ghi chú cũ', authorName: 'Quản lý B', createdAt: task.createdAt },
    ]);
  if (url.includes('/care/tasks')) return page([task]);
  return page([customer]);
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  adminRefreshSession.mockResolvedValue({ manager: staff });
  adminApi.mockReset();
  adminApi.mockImplementation(response);
  window.history.replaceState({}, '', '/manager/care');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('opens the care route and restores filters through URL and popstate', async () => {
  render(<ManagerApp />);
  await flush();
  expect(screen.getByText('Gọi chăm sóc')).toBeTruthy();
  expect(screen.getByText('Quá hạn', { selector: 'span' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Lọc trạng thái chăm sóc'), {
    target: { value: 'IN_PROGRESS' },
  });
  await flush();
  expect(window.location.search).toContain('status=IN_PROGRESS');
  expect(adminApi.mock.calls.at(-1)[0]).toContain('status=IN_PROGRESS');
  window.history.replaceState({}, '', '/manager/care?overdue=true&page=2');
  fireEvent.popState(window);
  await flush();
  expect(screen.getByLabelText('Lọc quá hạn').value).toBe('true');
  expect(adminApi.mock.calls.at(-1)[0]).toContain('page=2');
});
it('creates a task using selected customer, assignee and Vietnam deadline; blocks repeated submits', async () => {
  let resolve;
  adminApi.mockImplementation((url, options) =>
    options?.method === 'POST'
      ? new Promise(r => {
          resolve = r;
        })
      : response(url, options),
  );
  render(<ManagerApp />);
  await flush();
  fireEvent.click(screen.getByText('Tạo công việc chăm sóc'));
  await flush();
  fireEvent.change(screen.getByLabelText('Khách hàng'), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText('Người phụ trách'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Tiêu đề công việc'), {
    target: { value: 'Gọi lại khách' },
  });
  fireEvent.change(screen.getByLabelText('Hạn xử lý'), { target: { value: '2026-10-10T09:00' } });
  const form = screen.getByRole('form', { name: 'Tạo công việc chăm sóc' });
  fireEvent.submit(form);
  fireEvent.submit(form);
  await flush();
  const posts = adminApi.mock.calls.filter(([, o]) => o?.method === 'POST');
  expect(posts).toHaveLength(1);
  expect(posts[0][1].body).toMatchObject({
    customerId: 7,
    assigneeId: 3,
    dueAt: '2026-10-10T02:00:00.000Z',
  });
  await act(async () => resolve(task));
  await flush();
  expect(screen.getByText('Đã lưu công việc chăm sóc.')).toBeTruthy();
});
it('preserves drafts on errors and pauses polling while a task is edited', async () => {
  adminApi.mockImplementation((url, options) =>
    options?.method ? Promise.reject(new Error('Mất kết nối')) : response(url, options),
  );
  render(<ManagerApp />);
  await flush();
  fireEvent.click(screen.getByText('Xử lý công việc'));
  await flush();
  fireEvent.change(screen.getByLabelText('Tiêu đề công việc'), {
    target: { value: 'Giữ nội dung' },
  });
  const count = adminApi.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(10000));
  expect(adminApi.mock.calls).toHaveLength(count);
  fireEvent.submit(screen.getByRole('form', { name: 'Sửa công việc chăm sóc' }));
  await flush();
  expect(screen.getByRole('alert').textContent).toContain('Mất kết nối');
  expect(screen.getByLabelText('Tiêu đề công việc').value).toBe('Giữ nội dung');
});
it('shows notes in profile and preserves original list filters when care filters change', async () => {
  window.history.replaceState({}, '', '/manager/users/7?q=Alice&page=2&stage=LOYAL&tab=care');
  render(<ManagerApp />);
  await flush();
  expect(screen.getByText('Ghi chú cũ')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Lọc quá hạn'), { target: { value: 'true' } });
  await flush();
  expect(window.location.search).toContain('tab=care');
  expect(window.location.search).toContain('care_overdue=true');
  expect(window.location.search).toContain('q=Alice');
  fireEvent.change(screen.getByLabelText('Nội dung ghi chú'), { target: { value: 'Ghi chú mới' } });
  fireEvent.click(screen.getByText('Lưu ghi chú'));
  await flush();
  expect(
    adminApi.mock.calls.some(
      ([url, o]) => url === '/api/manager/users/7/care/notes' && o?.body?.content === 'Ghi chú mới',
    ),
  ).toBe(true);
  fireEvent.click(screen.getByText('← Danh sách khách hàng'));
  await flush();
  expect(window.location.search).toContain('stage=LOYAL');
});
it('keeps the last successful task list on polling failure and completed tasks cannot be edited', async () => {
  adminApi.mockResolvedValue(
    page([{ ...task, status: 'COMPLETED', overdue: false, completedAt: task.updatedAt }]),
  );
  render(<ManagerApp />);
  await flush();
  expect(screen.queryByText('Xử lý công việc')).toBeNull();
  adminApi.mockRejectedValue(new Error('Offline'));
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByText('Gọi chăm sóc')).toBeTruthy();
  expect(screen.getByText('Chưa cập nhật được dữ liệu mới')).toBeTruthy();
});
it('converts the deadline explicitly from Vietnam time', () =>
  expect(careDeadline('2026-10-06T00:00')).toBe('2026-10-05T17:00:00.000Z'));
it('restores outcome/completion filters and keeps them distinct from deadline filters', async () => {
  window.history.replaceState(
    {},
    '',
    '/manager/care?status=COMPLETED&outcome=UNRECORDED&completedFrom=2026-10-01&completedTo=2026-10-15&from=2026-01-01&page=1',
  );
  render(<ManagerApp />);
  await flush();
  expect(screen.getByLabelText('Lọc kết quả chăm sóc').value).toBe('UNRECORDED');
  expect(screen.getByLabelText('Hoàn thành từ ngày').value).toBe('2026-10-01');
  expect(screen.getByLabelText('Hạn từ ngày').value).toBe('2026-01-01');
  fireEvent.change(screen.getByLabelText('Lọc kết quả chăm sóc'), {
    target: { value: 'RESOLVED' },
  });
  await flush();
  expect(window.location.search).not.toContain('page=1');
  const url = adminApi.mock.calls.filter(([u]) => u.includes('/care/tasks?')).at(-1)[0];
  expect(url).toContain('completedFrom=2026-10-01');
  expect(url).toContain('from=2026-01-01');
  expect(url).toContain('outcome=RESOLVED');
});
it('places Manager navigation directly after the brand and the account/logout at the bottom', async () => {
  render(<ManagerApp />);
  await flush();
  const sidebar = document.querySelector('.manager-shell .admin-sidebar');
  const nav = within(sidebar).getByRole('navigation', { name: 'Chức năng quản lý' });
  const footer = sidebar.querySelector('.manager-sidebar-footer');
  expect(sidebar.querySelector('.admin-brand').nextElementSibling).toBe(nav);
  expect(nav.nextElementSibling).toBe(footer);
  expect(footer.querySelector('.admin-profile')).toBeTruthy();
  expect(within(footer).getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
  expect(within(nav).getAllByRole('button')).toHaveLength(13);
  expect(within(nav).getByRole('button', { name: 'Việc của tôi' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
  expect(sidebar.classList.contains('is-open')).toBe(true);
  fireEvent.click(within(nav).getByRole('button', { name: 'Chăm sóc khách hàng' }));
  await flush();
  expect(sidebar.classList.contains('is-open')).toBe(false);
  expect(window.location.pathname).toBe('/manager/care');
});
it('removes audit logs from Manager navigation and redirects the old route', async () => {
  window.history.replaceState({}, '', '/manager/audit-logs');
  render(<ManagerApp />);
  await flush();
  expect(window.location.pathname).toBe('/manager');
  expect(screen.queryByRole('button', { name: 'Nhật ký thao tác' })).toBeNull();
  const nav = screen.getByRole('navigation', { name: 'Chức năng quản lý' });
  expect(within(nav).getAllByRole('button')).toHaveLength(13);
});
it('requires an outcome on completion and retains outcome/note after a failed save', async () => {
  adminApi.mockImplementation((url, options) =>
    options?.method ? Promise.reject(new Error('Mất kết nối')) : response(url, options),
  );
  render(<ManagerApp />);
  await flush();
  fireEvent.click(screen.getByText('Xử lý công việc'));
  await flush();
  fireEvent.change(screen.getByLabelText('Trạng thái công việc'), {
    target: { value: 'COMPLETED' },
  });
  const form = screen.getByRole('form', { name: 'Sửa công việc chăm sóc' });
  fireEvent.submit(form);
  await flush();
  expect(screen.getByRole('alert').textContent).toContain('chọn kết quả');
  expect(adminApi.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(false);
  fireEvent.change(screen.getByLabelText('Kết quả chăm sóc'), { target: { value: 'UNREACHABLE' } });
  fireEvent.change(screen.getByLabelText('Ghi chú kết quả'), {
    target: { value: 'Khách chưa nghe máy' },
  });
  fireEvent.submit(form);
  await flush();
  expect(adminApi.mock.calls.find(([, o]) => o?.method === 'PATCH')[1].body).toMatchObject({
    status: 'COMPLETED',
    outcome: 'UNREACHABLE',
    resultNote: 'Khách chưa nghe máy',
  });
  expect(screen.getByLabelText('Ghi chú kết quả').value).toBe('Khách chưa nghe máy');
  expect(screen.getByLabelText('Kết quả chăm sóc').value).toBe('UNREACHABLE');
});
it('keeps legacy results unknown and schedules an explicit follow-up without customer/source overrides', async () => {
  const done = {
    ...task,
    status: 'COMPLETED',
    outcome: null,
    sourceType: 'RETURN_ORDER',
    sourceId: 99,
  };
  adminApi.mockImplementation((url, options) =>
    options?.method
      ? Promise.resolve({ ...task, id: 9, parentTaskId: 8 })
      : url.includes('/care/tasks')
        ? Promise.resolve(page([done]))
        : response(url, options),
  );
  render(<ManagerApp />);
  await flush();
  expect(screen.getByText('Chưa ghi nhận kết quả', { selector: 'strong' })).toBeTruthy();
  fireEvent.click(screen.getByText('Hẹn chăm sóc lại'));
  await flush();
  expect(screen.getByLabelText('Tiêu đề công việc').value).toBe('Theo dõi tiếp: Gọi chăm sóc');
  expect(screen.queryByLabelText('Kết quả chăm sóc')).toBeNull();
  fireEvent.change(screen.getByLabelText('Hạn xử lý'), { target: { value: '2099-10-10T09:00' } });
  const form = screen.getByRole('form', { name: 'Hẹn chăm sóc lại' });
  fireEvent.submit(form);
  fireEvent.submit(form);
  await flush();
  const requests = adminApi.mock.calls.filter(([, o]) => o?.method === 'POST');
  expect(requests).toHaveLength(1);
  expect(requests[0][0]).toBe('/api/manager/care/tasks/8/follow-up');
  expect(requests[0][1].body.dueAt).toBe('2099-10-10T02:00:00.000Z');
  expect(requests[0][1].body).not.toHaveProperty('customerId');
  expect(requests[0][1].body).not.toHaveProperty('sourceId');
});
it('shows saved result, parent/next links and no duplicate follow-up action', async () => {
  adminApi.mockResolvedValue(
    page([
      {
        ...task,
        status: 'COMPLETED',
        outcome: 'NEEDS_FOLLOW_UP',
        resultNote: 'Hẹn gọi lần nữa',
        parentTaskId: 6,
        followUpTaskId: 9,
      },
    ]),
  );
  render(<ManagerApp />);
  await flush();
  expect(screen.getByText('Cần theo dõi tiếp', { selector: 'strong' })).toBeTruthy();
  expect(screen.getByText('Hẹn gọi lần nữa')).toBeTruthy();
  expect(screen.getByText('Tiếp nối công việc #6')).toBeTruthy();
  expect(screen.getByText('Đã hẹn công việc kế tiếp #9')).toBeTruthy();
  expect(screen.queryByText('Hẹn chăm sóc lại')).toBeNull();
});
it('offers follow-up immediately after completion even while the list is filtered to unfinished work', async () => {
  window.history.replaceState({}, '', '/manager/care?status=TODO');
  adminApi.mockImplementation((url, options) =>
    options?.method === 'PATCH'
      ? Promise.resolve({
          ...task,
          status: 'COMPLETED',
          outcome: 'NEEDS_FOLLOW_UP',
          resultNote: 'Gọi lại',
        })
      : response(url, options),
  );
  render(<ManagerApp />);
  await flush();
  fireEvent.click(screen.getByText('Xử lý công việc'));
  await flush();
  fireEvent.change(screen.getByLabelText('Trạng thái công việc'), {
    target: { value: 'COMPLETED' },
  });
  fireEvent.change(screen.getByLabelText('Kết quả chăm sóc'), {
    target: { value: 'NEEDS_FOLLOW_UP' },
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Sửa công việc chăm sóc' }));
  await flush();
  expect(window.location.search).toContain('status=TODO');
  expect(adminApi.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByText('Hẹn chăm sóc lại cho công việc vừa hoàn thành'));
  await flush();
  expect(screen.getByRole('form', { name: 'Hẹn chăm sóc lại' })).toBeTruthy();
});
