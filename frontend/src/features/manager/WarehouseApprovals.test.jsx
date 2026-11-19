// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WarehouseApprovals from './WarehouseApprovals';
import { adminApi } from '../../api/manager-api';

vi.mock('../../api/manager-api', async importOriginal => ({ ...(await importOriginal()), adminApi: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  adminApi.mockImplementation(async (url, options = {}) => {
    if (url.includes('/material-requests?')) return { content: [{ id: 4, requestCode: 'YC-004', planCode: 'PP-001', employeeName: 'Minh', status: 'PENDING', items: [] }] };
    if (options.method === 'PATCH') return { id: 4, status: options.body.decision };
    return { content: [] };
  });
});
afterEach(cleanup);

it('approves a pending material request and shows the result', async () => {
  render(<WarehouseApprovals />);
  expect(await screen.findByText('YC-004')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt YC-004' }));
  await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/api/manager/warehouse/material-requests/4/decision', expect.objectContaining({
    method: 'PATCH', body: { decision: 'APPROVE', note: '' },
  })));
  expect((await screen.findByRole('status')).textContent).toContain('Đã duyệt yêu cầu YC-004.');
});
