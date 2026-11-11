// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, it, vi, expect } from 'vitest';
import SourceCareCreator from './SourceCareCreator';
import { adminApi } from '../../api/manager-api';
vi.mock('../../api/manager-api', async original => ({ ...(await original()), adminApi: vi.fn() }));
const source = {
  sourceType: 'RETURN_ORDER',
  sourceId: 8,
  customerId: 3,
  customerName: 'Khách thử',
  title: 'Chăm sóc đổi trả đơn #9008',
  openTaskId: null,
};
beforeEach(() => {
  adminApi.mockReset();
  adminApi.mockImplementation(async url =>
    url.includes('/sources/')
      ? source
      : {
          content: [{ id: 4, fullName: 'Quản lý', email: 'manager@test' }],
          totalPages: 1,
          totalElements: 1,
        },
  );
});
afterEach(cleanup);
const open = async () => {
  fireEvent.click(screen.getByText('Tạo công việc chăm sóc'));
  await screen.findByLabelText('Tiêu đề công việc');
};
const fill = async () => {
  await waitFor(() => expect(screen.getByLabelText('Người phụ trách').tagName).toBe('SELECT'));
  fireEvent.change(screen.getByLabelText('Người phụ trách'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Hạn xử lý'), { target: { value: '2026-10-20T10:00' } });
};
it('opens authoritative customer/source, requires staff/deadline and posts the source link', async () => {
  render(<SourceCareCreator type="RETURN_ORDER" id={8} />);
  expect(adminApi).not.toHaveBeenCalled();
  await open();
  expect(screen.getByLabelText('Tiêu đề công việc').value).toBe(source.title);
  expect(screen.getByText('Khách thử')).toBeTruthy();
  await fill();
  adminApi.mockImplementation(async (url, options) =>
    options?.method === 'POST' ? { id: 55 } : source,
  );
  fireEvent.click(screen.getByText('Lưu công việc'));
  await screen.findByText(/Đã tạo công việc #55/);
  const call = adminApi.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(call[1].body).toMatchObject({
    customerId: 3,
    sourceType: 'RETURN_ORDER',
    sourceId: 8,
    assigneeId: 4,
  });
  expect(call[1].body.dueAt).toBe('2026-10-20T03:00:00.000Z');
  expect(screen.getByText('Theo dõi công việc chăm sóc').getAttribute('href')).toContain(
    'sourceId=8',
  );
  expect(screen.getByText('Theo dõi công việc chăm sóc').getAttribute('href')).toContain(
    'taskId=55',
  );
});
it('shows existing open task instead of a duplicate form', async () => {
  adminApi.mockResolvedValue({ ...source, openTaskId: 22 });
  render(<SourceCareCreator type="RETURN_ORDER" id={8} />);
  fireEvent.click(screen.getByText('Tạo công việc chăm sóc'));
  await screen.findByText(/Đã có công việc đang mở #22/);
  expect(screen.queryByLabelText('Tiêu đề công việc')).toBeNull();
  expect(screen.getByText('Xem công việc đang mở').getAttribute('href')).toContain(
    'sourceType=RETURN_ORDER',
  );
  expect(screen.getByText('Xem công việc đang mở').getAttribute('href')).toContain('taskId=22');
});
it('keeps a draft after conflict and does not send duplicate submissions', async () => {
  render(<SourceCareCreator type="FEEDBACK" id={8} />);
  await open();
  await fill();
  fireEvent.change(screen.getByLabelText('Nội dung công việc'), {
    target: { value: 'Bản nháp cần giữ' },
  });
  let reject;
  adminApi.mockImplementation(
    () =>
      new Promise((resolve, r) => {
        reject = r;
      }),
  );
  fireEvent.click(screen.getByText('Lưu công việc'));
  fireEvent.submit(screen.getByRole('form', { name: 'Tạo công việc chăm sóc' }));
  expect(adminApi.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(1);
  await act(async () => reject(new Error('Nguồn này đã có công việc chăm sóc đang mở #12.')));
  expect(screen.getByRole('alert').textContent).toContain('#12');
  expect(screen.getByLabelText('Nội dung công việc').value).toBe('Bản nháp cần giữ');
});
it('supports retry and cancel without posting, ignores responses after unmount', async () => {
  adminApi.mockRejectedValueOnce(new Error('Offline'));
  const view = render(<SourceCareCreator type="FEEDBACK" id={8} />);
  fireEvent.click(screen.getByText('Tạo công việc chăm sóc'));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByText('Thử lại'));
  await screen.findByLabelText('Tiêu đề công việc');
  fireEvent.click(screen.getByText('Hủy'));
  expect(screen.queryByLabelText('Tiêu đề công việc')).toBeNull();
  view.unmount();
  expect(adminApi.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
});
