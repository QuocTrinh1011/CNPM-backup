import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../../api/manager-api';
import {
  beginManagerMutation,
  isManagerMutating,
  subscribeManagerMutations,
} from '../../api/manager-sync';

export const MANAGER_POLL_MS = 5000;
let nextId = 0;
const visible = () => document.visibilityState !== 'hidden';

export function useManagerResource(fetcher, { enabled = true, keepPreviousData = false } = {}) {
  const dataRef = useRef(null),
    loadedFetcher = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [backgroundError, setBackgroundError] = useState('');
  const state = useRef({
    mounted: false,
    version: 0,
    controller: null,
    hasData: false,
    halted: false,
  });
  const id = useRef(null);
  if (id.current === null) id.current = ++nextId;
  const warn = useCallback((message, retry) => {
    window.dispatchEvent(
      new CustomEvent('manager:sync-warning', { detail: { id: id.current, message, retry } }),
    );
  }, []);
  const load = useCallback(
    async (silent = false) => {
      const s = state.current;
      if (!s.mounted || !enabled || s.halted || isManagerMutating()) return;
      if (silent && (!visible() || s.controller)) return;
      s.controller?.abort();
      const controller = new AbortController();
      s.controller = controller;
      const version = ++s.version;
      const current = () => s.mounted && version === s.version && !controller.signal.aborted;
      if (!silent || !s.hasData) setLoading(true);
      setRefreshing(true);
      if (!s.hasData) setError('');
      try {
        const result = await fetcher(controller.signal);
        if (!current()) return;
        s.hasData = true;
        loadedFetcher.current = fetcher;
        dataRef.current = result;
        setData(result);
        setError('');
        setBackgroundError('');
        warn('');
      } catch (failure) {
        if (!current()) return;
        const message = failure.message || 'Không tải được dữ liệu.';
        if ([401, 403, 423].includes(failure.status)) {
          s.halted = true;
          window.dispatchEvent(new CustomEvent('manager:session-expired'));
        }
        if (s.hasData) {
          setBackgroundError(message);
          warn(message, () => load(true));
        } else setError(message);
      } finally {
        if (current()) {
          s.controller = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, fetcher, warn],
  );
  useEffect(() => {
    const s = state.current;
    s.mounted = true;
    s.hasData = keepPreviousData && dataRef.current !== null;
    s.halted = false;
    if (!keepPreviousData) {
      setData(null);
      dataRef.current = null;
    }
    setError('');
    setBackgroundError('');
    setLoading(enabled);
    warn('');
    const invalidate = () => {
      ++s.version;
      s.controller?.abort();
      s.controller = null;
    };
    if (enabled && visible()) void load();
    const timer = enabled ? window.setInterval(() => void load(true), MANAGER_POLL_MS) : null;
    const onVisibility = () => {
      if (visible()) void load(true);
      else {
        invalidate();
        setRefreshing(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const unsubscribe = subscribeManagerMutations(active => {
      if (active) {
        invalidate();
        setRefreshing(false);
      } else if (visible()) void load(true);
    });
    return () => {
      s.mounted = false;
      invalidate();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
      warn('');
    };
  }, [load, enabled, warn, keepPreviousData]);
  return {
    data,
    loading,
    refreshing,
    error,
    backgroundError,
    load,
    stale: loadedFetcher.current !== fetcher,
  };
}

export function useManagerList(endpoint, options) {
  const fetcher = useCallback(signal => adminApi(endpoint(), { signal }), [endpoint]);
  return useManagerResource(fetcher, options);
}

// Editors mounted inside a row must not disappear when a background refresh
// removes/reorders that row. Resume and reconcile once the draft is closed.
export function useManagerReadPause(editing) {
  useEffect(() => (editing ? beginManagerMutation() : undefined), [editing]);
}

export function ManagerSyncStatus() {
  const [warnings, setWarnings] = useState({});
  useEffect(() => {
    const receive = ({ detail }) =>
      setWarnings(previous => {
        const next = { ...previous };
        if (detail.message) next[detail.id] = detail;
        else delete next[detail.id];
        return next;
      });
    window.addEventListener('manager:sync-warning', receive);
    return () => window.removeEventListener('manager:sync-warning', receive);
  }, []);
  const entries = Object.values(warnings);
  if (!entries.length) return null;
  return (
    <div className="admin-list-error" role="status">
      <div>
        <b>Chưa cập nhật được dữ liệu mới</b>
        <p>{entries[0].message} Dữ liệu đã tải vẫn được giữ nguyên.</p>
      </div>
      <button className="admin-action" onClick={() => entries.forEach(entry => entry.retry?.())}>
        Thử lại
      </button>
    </div>
  );
}
