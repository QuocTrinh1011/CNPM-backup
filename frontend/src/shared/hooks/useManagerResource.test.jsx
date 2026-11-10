// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { act, cleanup, renderHook, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useManagerResource, useManagerList, ManagerSyncStatus } from './useManagerResource';
import { beginManagerMutation } from '../../api/manager-sync';
import { adminApi } from '../../api/manager-api';
vi.mock('../../api/manager-api', () => ({ adminApi: vi.fn() }));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { await act(async () => {}); };
const tick = async (ms = 5000) => { await act(async () => vi.advanceTimersByTimeAsync(ms)); };
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  adminApi.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('loads immediately, then every 5 seconds without replacing the loading UI', async () => {
  const fetcher = vi.fn().mockResolvedValue({ count: 1 });
  const { result } = renderHook(() => useManagerResource(fetcher));
  await flush();
  await tick(4999); expect(fetcher).toHaveBeenCalledTimes(1);
  const pending = deferred(); fetcher.mockReturnValueOnce(pending.promise);
  await tick(1);
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toEqual({ count: 1 });
  expect(result.current.refreshing).toBe(true);
  await act(async () => pending.resolve({ count: 2 }));
  expect(result.current.data.count).toBe(2);
});
it('never overlaps polling requests and aborts on unmount', async () => {
  const pending = deferred(), fetcher = vi.fn(() => pending.promise);
  const { unmount } = renderHook(() => useManagerResource(fetcher));
  await tick(20000); expect(fetcher).toHaveBeenCalledTimes(1);
  unmount(); expect(fetcher.mock.calls[0][0].aborted).toBe(true);
  await tick(10000); expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve({ count: 1 }));
});
it('pauses in a hidden tab and immediately reloads on return', async () => {
  const fetcher = vi.fn().mockResolvedValue(1);
  renderHook(() => useManagerResource(fetcher)); await flush();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await tick(15000); expect(fetcher).toHaveBeenCalledTimes(1);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  act(() => document.dispatchEvent(new Event('visibilitychange'))); await flush();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not load an initially hidden or disabled resource', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const fetcher = vi.fn().mockResolvedValue(1);
  const { rerender } = renderHook(({ enabled }) => useManagerResource(fetcher, { enabled }), { initialProps: { enabled: false } });
  await tick(); expect(fetcher).not.toHaveBeenCalled();
  rerender({ enabled: true }); await flush(); expect(fetcher).not.toHaveBeenCalled();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  act(() => document.dispatchEvent(new Event('visibilitychange'))); await flush();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('keeps data on a network error and clears the warning after recovery', async () => {
  const fetcher = vi.fn().mockResolvedValue(1);
  render(<ManagerSyncStatus/>);
  const { result } = renderHook(() => useManagerResource(fetcher)); await flush();
  fetcher.mockRejectedValueOnce(new Error('Offline'));
  await tick();
  expect(result.current.data).toBe(1); expect(result.current.error).toBe('');
  expect(result.current.backgroundError).toBe('Offline');
  expect(screen.getByText('Chưa cập nhật được dữ liệu mới')).toBeTruthy();
  fireEvent.click(screen.getByText('Thử lại')); await flush();
  expect(result.current.backgroundError).toBe('');
  expect(screen.queryByText('Chưa cập nhật được dữ liệu mới')).toBeNull();
});
it('recovers from an initial failure at the next polling tick', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(2);
  const { result } = renderHook(() => useManagerResource(fetcher)); await flush();
  expect(result.current.error).toBe('Offline');
  await tick(); expect(result.current.error).toBe(''); expect(result.current.data).toBe(2);
});
it('discards obsolete filter requests and keeps the current endpoint on every poll', async () => {
  const old = deferred();
  const first = vi.fn(() => old.promise), second = vi.fn().mockResolvedValue(2);
  const { result, rerender } = renderHook(({ fetcher }) => useManagerResource(fetcher), { initialProps: { fetcher: first } });
  rerender({ fetcher: second }); await flush();
  await act(async () => old.resolve(1)); expect(result.current.data).toBe(2);
  await tick(); expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(2);
});
it('invalidates in-flight reads during a save and reloads once it finishes', async () => {
  const stale = deferred(), fetcher = vi.fn().mockResolvedValueOnce(1).mockReturnValueOnce(stale.promise).mockResolvedValue(3);
  const { result } = renderHook(() => useManagerResource(fetcher)); await flush(); await tick();
  let finish;
  act(() => { finish = beginManagerMutation(); });
  expect(fetcher.mock.calls[1][0].aborted).toBe(true);
  await act(async () => stale.resolve(2)); await tick(10000);
  expect(result.current.data).toBe(1); expect(fetcher).toHaveBeenCalledTimes(2);
  act(() => finish()); await flush();
  expect(result.current.data).toBe(3); expect(fetcher).toHaveBeenCalledTimes(3);
});
it('stops polling and requests login after authentication expires', async () => {
  const expired = vi.fn(); window.addEventListener('manager:session-expired', expired);
  const fetcher = vi.fn().mockRejectedValue(Object.assign(new Error('Expired'), { status: 401 }));
  renderHook(() => useManagerResource(fetcher)); await flush(); await tick(20000);
  expect(expired).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1);
  window.removeEventListener('manager:session-expired', expired);
});
it('StrictMode cleans up its first request and leaves a single polling timer', async () => {
  const fetcher = vi.fn().mockResolvedValue(1);
  renderHook(() => useManagerResource(fetcher), { reactStrictMode: true, wrapper: ({ children }) => <StrictMode>{children}</StrictMode> });
  await flush(); expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0].aborted).toBe(true);
  await tick(); expect(fetcher).toHaveBeenCalledTimes(3);
});
it('polls the selected list page with its original filters', async () => {
  const endpoint = () => '/api/manager/orders?status=PENDING&page=2&size=10';
  adminApi.mockResolvedValue({ content: [], totalPages: 3 });
  renderHook(() => useManagerList(endpoint)); await flush(); await tick();
  expect(adminApi.mock.calls.map(([url]) => url)).toEqual([endpoint(), endpoint()]);
});
