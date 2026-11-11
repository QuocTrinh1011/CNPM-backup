// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import SurveyFilterPicker from './SurveyFilterPicker';
import { groupSurveyRoute, groupSurveySource } from './SurveyRecipientGroup';
import { adminApi } from '../../api/manager-api';
vi.mock('../../api/manager-api', async original => ({ ...(await original()), adminApi: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const result = {
  options: { content: [{ id: 2, title: 'Other survey', status: 'PUBLISHED' }], totalPages: 2 },
  selected: { id: 77, title: 'Old selected survey', status: 'DRAFT', deleted: true },
};
it('keeps an archived selection outside the current page while searching and paging', async () => {
  adminApi.mockResolvedValue(result);
  const change = vi.fn();
  render(<SurveyFilterPicker value="77" onChange={change} />);
  expect(await screen.findByRole('option', { name: /Old selected survey.*Đã xóa/ })).toBeTruthy();
  expect(screen.getByLabelText('Khảo sát cụ thể').value).toBe('77');
  fireEvent.change(screen.getByLabelText('Tìm khảo sát để lọc'), { target: { value: 'Other' } });
  await act(async () => {});
  expect(adminApi.mock.calls.at(-1)[0]).toContain('q=Other');
  expect(adminApi.mock.calls.at(-1)[0]).toContain('selectedId=77');
  fireEvent.click(screen.getByText('Khảo sát sau'));
  await act(async () => {});
  expect(adminApi.mock.calls.at(-1)[0]).toContain('page=1');
  fireEvent.click(screen.getByText('Bỏ chọn khảo sát cụ thể'));
  expect(change).toHaveBeenCalledWith('');
});
it('retains the selected ID on errors and can retry without silently removing the filter', async () => {
  adminApi.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(result);
  const change = vi.fn();
  render(<SurveyFilterPicker value="77" onChange={change} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Offline');
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Khảo sát cụ thể').value).toBe('77');
  fireEvent.click(screen.getByText('Thử lại danh sách khảo sát'));
  expect(await screen.findByRole('option', { name: /Old selected survey/ })).toBeTruthy();
});
it('ignores a stale search response and preserves survey filters on group round trips', async () => {
  let finish;
  adminApi
    .mockReturnValueOnce(
      new Promise(r => {
        finish = r;
      }),
    )
    .mockResolvedValue(result);
  const view = render(<SurveyFilterPicker value="77" onChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Tìm khảo sát để lọc'), { target: { value: 'New' } });
  await screen.findByRole('option', { name: /Old selected survey/ });
  await act(async () =>
    finish({
      options: { content: [{ id: 3, title: 'Stale survey' }], totalPages: 1 },
      selected: null,
    }),
  );
  expect(screen.queryByRole('option', { name: /Stale survey/ })).toBeNull();
  const route = groupSurveyRoute(
    new URLSearchParams('surveyId=77&surveyed=false&page=2&sort=completedOrders'),
  );
  const source = groupSurveySource(`/manager/${route}`);
  expect(source.filter).toEqual({ surveyed: false, surveyId: '77' });
  expect(source.back).toContain('surveyId=77');
  expect(source.back).toContain('page=2');
  view.unmount();
});
