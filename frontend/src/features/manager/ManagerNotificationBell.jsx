import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { adminApi } from '../../api/manager-api';
import { useManagerResource } from '../../shared/hooks/useManagerResource';
import './styles/manager-care-inbox.css';

export default function ManagerNotificationBell({ go, location }) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false),
    root = useRef(null),
    trigger = useRef(null),
    alive = useRef(true),
    route = useRef(location);
  route.current = location;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setOpen(false);
    setError('');
  }, [location]);
  const summaryFetch = useCallback(
    signal => adminApi('/api/manager/notifications/summary', { signal }),
    [],
  );
  const fetcher = useCallback(
    signal => adminApi(`/api/manager/notifications?page=${page}&size=10`, { signal }),
    [page],
  );
  const summary = useManagerResource(summaryFetch, { keepPreviousData: true }),
    list = useManagerResource(fetcher, { enabled: open, keepPreviousData: true }),
    data = list.stale ? null : list.data;
  useEffect(() => {
    if (!open) return;
    const outside = e => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    const escape = e => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const read = async item => {
    if (lock.current) return;
    const startedOn = route.current;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await adminApi(
        item ? `/api/manager/notifications/${item.id}/read` : '/api/manager/notifications/read-all',
        { method: 'PATCH' },
      );
      if (!alive.current || route.current !== startedOn) return;
      summary.load();
      if (item) {
        setOpen(false);
        go(item.ticketId ? `support-tickets?id=${item.ticketId}` : `care?taskId=${item.taskId}`);
      } else list.load();
    } catch (e) {
      if (alive.current && route.current === startedOn) setError(e.message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const failure =
    error || list.error || list.backgroundError || summary.error || summary.backgroundError;
  return (
    <div className="manager-notification-bell" ref={root}>
      <button
        ref={trigger}
        className="admin-action"
        aria-label={`Thông báo chăm sóc: ${summary.data?.unreadCount ?? 0} chưa đọc`}
        aria-expanded={open}
        aria-controls="manager-notification-panel"
        onClick={() => {
          setOpen(v => !v);
          setPage(0);
        }}
      >
        <Bell size={18} />
        <span>{summary.data?.unreadCount ?? 0}</span>
        {(summary.error || summary.backgroundError) && (
          <span aria-label="Lỗi tải thông báo">!</span>
        )}
      </button>
      {open && (
        <section
          id="manager-notification-panel"
          className="manager-notification-panel"
          aria-label="Thông báo chăm sóc"
        >
          <h2>Thông báo chăm sóc</h2>
          <div className="care-actions">
            <button className="admin-action" disabled={busy} onClick={() => read(null)}>
              Đánh dấu tất cả đã đọc
            </button>
            <button
              className="admin-action"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Đóng
            </button>
          </div>
          {failure && (
            <p role="alert">
              {failure}{' '}
              <button
                className="admin-action"
                disabled={busy}
                onClick={() => {
                  setError('');
                  summary.load();
                  list.load();
                }}
              >
                Thử lại
              </button>
            </p>
          )}
          {list.loading && !data && <p role="status">Đang tải thông báo…</p>}
          {data && !data.page.content.length && <p>Chưa có thông báo chăm sóc.</p>}
          <ul>
            {data?.page.content.map(item => (
              <li key={item.id}>
                <button
                  className="manager-notification-item"
                  disabled={busy}
                  onClick={() => read(item)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.content}</span>
                  <small>
                    {new Date(item.createdAt).toLocaleString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                    })}{' '}
                    ·{' '}
                    {item.state === 'COMPLETED'
                      ? 'Đã hoàn thành'
                      : !item.applicable
                        ? 'Không còn áp dụng'
                        : item.readAt
                          ? 'Đã đọc'
                          : 'Chưa đọc'}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          <div className="admin-pagination">
            <button
              className="admin-action"
              disabled={busy || list.loading || page === 0}
              onClick={() => setPage(n => n - 1)}
            >
              Trước
            </button>
            <span>
              Trang {page + 1}/{Math.max(1, data?.page.totalPages || 0)}
            </span>
            <button
              className="admin-action"
              disabled={busy || list.loading || !data || page + 1 >= data.page.totalPages}
              onClick={() => setPage(n => n + 1)}
            >
              Sau
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
