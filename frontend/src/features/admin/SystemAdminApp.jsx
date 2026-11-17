import React, { useEffect, useState } from 'react';
import { adminRefreshSession, adminSignIn, adminSignOut } from '../../api/api';
import InternalDirectory from './InternalDirectory';
import AuditLogs from './AuditLogs';
import AdminDashboard from './AdminDashboard';
import '../../shared/styles/internal-portal.css';
import {
  LayoutDashboard,
  ShieldCheck,
  Package,
  LogOut,
  Sun,
  Moon,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Activity,
  Layers,
  ChevronRight,
  Shield,
  Server,
  Database,
  Lock,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

const menu = {
  dashboard: 'Tổng quan',
  accounts: 'Tài khoản nội bộ',
  products: 'Sản phẩm',
  'audit-logs': 'Nhật ký thao tác',
};

const menuIcons = {
  dashboard: LayoutDashboard,
  accounts: ShieldCheck,
  products: Package,
  'audit-logs': Activity,
};

export default function SystemAdminApp() {
  const managerUrl = `${(import.meta.env.VITE_MANAGER_ORIGIN || 'http://localhost:5175').replace(/\/+$/, '')}/manager`;
  const storefrontUrl = `${(import.meta.env.VITE_USER_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '')}/`;
  const [path, setPath] = useState(window.location.pathname);
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('admin-theme') || 'dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => {
      try {
        return localStorage.getItem('admin-sidebar-collapsed') === 'true';
      } catch {
        return false;
      }
    }
  );
  const [form, setForm] = useState({ email: 'admin@shop.com', password: '' });
  const [retry, setRetry] = useState(0);

  const go = (url, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
    setPath(url);
  };
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    let alive = true;
    setChecking(true);
    setError('');
    adminRefreshSession()
      .then((s) => {
        if (alive) setSession(s?.admin || null);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [retry]);

  const section = path === '/admin' ? 'dashboard' : path.split('/')[2];

  useEffect(() => {
    if (checking || error) return;
    if (!session && path !== '/admin/login') {
      go('/admin/login', true);
    } else if (
      session &&
      (!menu[section] || path !== `/admin${section === 'dashboard' ? '' : '/' + section}`)
    ) {
      go('/admin', true);
    }
  }, [checking, session, path, error, section]);

  useEffect(() => {
    localStorage.setItem('admin-theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('admin-sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // Keep the sidebar usable in memory when persistence is unavailable.
    }
  }, [sidebarCollapsed]);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const s = await adminSignIn(form);
      setSession(s.admin);
      go('/admin');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-shell internal-portal" data-theme={theme}>
      {checking ? (
        <div className="internal-loading-wrap" style={{ margin: 'auto', padding: '60px', textAlign: 'center' }}>
          <p>Đang kiểm tra phiên làm việc...</p>
        </div>
      ) : !session ? (
        <main className="admin-card internal-login">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--admin-primary)', color: '#fff', display: 'grid', placeItems: 'center' }}>
              <ShieldCheck size={18} />
            </span>
            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: 'var(--admin-primary)' }}>SYSTEM ADMIN</span>
          </div>
          <h1>Admin hệ thống</h1>
          <p>Quản trị tài khoản nội bộ và tra cứu sản phẩm.</p>
          <form onSubmit={login}>
            <label>
              Email
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <button disabled={busy} type="submit">
              {busy ? 'Đang xác thực...' : 'Đăng nhập Admin'}
            </button>
          </form>
        </main>
      ) : (
        <>
          <aside id="admin-sidebar" className={`internal-sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`}>
            <div className="internal-brand">
              <span className="internal-brand-icon">
                <ShieldCheck size={20} />
              </span>
              <div className="internal-brand-title">
                <h2>System Admin</h2>
                <small>TRUNG TÂM HỆ THỐNG</small>
              </div>
              <button
                type="button"
                className="internal-collapse-toggle"
                aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
                aria-expanded={!sidebarCollapsed}
                aria-controls="admin-sidebar"
                title={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
                onClick={() => setSidebarCollapsed((value) => !value)}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen size={16} aria-hidden="true" />
                ) : (
                  <PanelLeftClose size={16} aria-hidden="true" />
                )}
              </button>
            </div>

            <nav className="internal-nav">
              {Object.entries(menu).map(([key, label]) => {
                const Icon = menuIcons[key] || LayoutDashboard;
                return (
                  <a
                    key={key}
                    className={`internal-nav-link ${section === key ? 'active' : ''}`}
                    aria-current={section === key ? 'page' : undefined}
                    title={sidebarCollapsed ? label : undefined}
                    href={`/admin${key === 'dashboard' ? '' : '/' + key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      go(e.currentTarget.getAttribute('href'));
                    }}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{label}</span>
                  </a>
                );
              })}

              <div className="internal-sidebar-divider" />
              <div className="internal-sidebar-section-title">LIÊN KẾT NHANH</div>

              <a
                className="internal-nav-link external"
                href={managerUrl}
                title={sidebarCollapsed ? 'Cổng quản lý (Manager)' : 'Mở cổng quản lý đơn hàng & khách hàng'}
              >
                <Layers size={17} aria-hidden="true" />
                <span>Cổng quản lý (Manager)</span>
                <ExternalLink size={12} className="external-icon" />
              </a>

              <a
                className="internal-nav-link external"
                href={storefrontUrl}
                title={sidebarCollapsed ? 'Xem trang bán hàng' : 'Xem website bán hàng khách hàng'}
              >
                <ExternalLink size={17} aria-hidden="true" />
                <span>Xem trang bán hàng</span>
              </a>
            </nav>

            <div className="internal-sidebar-footer">
              <div className="internal-user-card">
                <div className="internal-user-avatar">A</div>
                <div className="internal-user-info">
                  <b>{session.email}</b>
                  <small>Quản trị viên tối cao</small>
                </div>
              </div>
              <button
                type="button"
                className="internal-logout-btn"
                title={sidebarCollapsed ? 'Đăng xuất' : undefined}
                onClick={async () => {
                  await adminSignOut();
                  setSession(null);
                  go('/admin/login');
                }}
              >
                <LogOut size={15} aria-hidden="true" />
                <span className="internal-logout-label">Đăng xuất</span>
              </button>
            </div>
          </aside>

          <main className="internal-main">
            <header className="internal-header">
              <div className="internal-header-left">
                <span className="internal-breadcrumb">
                  System Admin <span>/</span> <b>{menu[section]}</b>
                </span>
                <h1>{menu[section]}</h1>
              </div>
              <div className="internal-header-right">
                <span className="internal-live-badge">
                  <i /> HỆ THỐNG TRỰC TUYẾN
                </span>
                <button
                  type="button"
                  className="internal-theme-toggle"
                  aria-label={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
                  onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</span>
                </button>
              </div>
            </header>

            {section === 'dashboard' ? (
              <AdminDashboard
                session={session}
                go={go}
                managerUrl={managerUrl}
              />
            ) : (
              section === 'audit-logs' ? <AuditLogs /> : menu[section] && <InternalDirectory key={section} kind={section} />
            )}
          </main>
        </>
      )}
      {error && (
        <div className="admin-card" role="alert" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100, borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Thử lại
          </button>
        </div>
      )}
    </div>
  );
}
