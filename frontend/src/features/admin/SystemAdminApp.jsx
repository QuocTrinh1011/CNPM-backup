import React, { useEffect, useState } from 'react';
import { adminApi, adminRefreshSession, adminSignIn, adminSignOut } from '../../api/api';
import InternalDirectory from './InternalDirectory';
import AuditLogs from './AuditLogs';
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
  PanelLeftOpen,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [form, setForm] = useState({ email: 'admin@shop.com', password: '' });
  const [overview, setOverview] = useState(null);
  const [retry, setRetry] = useState(0);

  const go = (url, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
    setPath(url);
  };
  const followInternalLink = event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    go(event.currentTarget.getAttribute('href'));
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
      .then(s => {
        if (alive) setSession(s?.admin || null);
      })
      .catch(e => {
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

  useEffect(() => {
    if (!session) return;
    let alive = true;
    adminApi('/api/admin/overview')
      .then(d => {
        if (alive) setOverview(d);
      })
      .catch(e => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [session, retry]);

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
        <div
          className="internal-loading-wrap"
          style={{ margin: 'auto', padding: '60px', textAlign: 'center' }}
        >
          <p>Đang kiểm tra phiên làm việc...</p>
        </div>
      ) : !session ? (
        <main className="admin-card internal-login">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--admin-primary)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <ShieldCheck size={18} />
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.08em',
                color: 'var(--admin-primary)',
              }}
            >
              SYSTEM ADMIN
            </span>
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
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <button disabled={busy} type="submit">
              {busy ? 'Đang xác thực...' : 'Đăng nhập Admin'}
            </button>
          </form>
        </main>
      ) : (
        <>
          <aside
            id="admin-sidebar"
            className={`internal-sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`}
          >
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
                aria-label={
                  sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'
                }
                aria-expanded={!sidebarCollapsed}
                aria-controls="admin-sidebar"
                title={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
                onClick={() => setSidebarCollapsed(value => !value)}
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
                    onClick={e => {
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
                title={
                  sidebarCollapsed
                    ? 'Cổng quản lý (Manager)'
                    : 'Mở cổng quản lý đơn hàng & khách hàng'
                }
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
                  onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</span>
                </button>
              </div>
            </header>

            {section === 'dashboard' ? (
              <div className="internal-dashboard" style={{ display: 'grid', gap: '22px' }}>
                {/* Hero Banner */}
                <div className="internal-hero-banner">
                  <div className="internal-hero-text">
                    <span className="internal-eyebrow">BẢNG ĐIỀU KHIỂN HẠ TẦNG</span>
                    <h2>Xin chào, {session.email?.split('@')[0] || 'Admin'}!</h2>
                    <p>
                      Giám sát và phân quyền tài khoản quản trị, danh mục sản phẩm và đối tác cung
                      ứng kết nối.
                    </p>
                  </div>
                  <div className="internal-hero-actions">
                    <button
                      type="button"
                      className="internal-sync-btn"
                      onClick={() => setRetry(n => n + 1)}
                      title="Tải lại số liệu mới nhất"
                    >
                      <RefreshCw size={13} />
                      <span>Làm mới dữ liệu</span>
                    </button>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="internal-kpi-grid">
                  <div
                    className="internal-kpi-card blue"
                    role="button"
                    tabIndex={0}
                    onClick={() => go('/admin/accounts')}
                    title="Xem danh sách tài khoản nội bộ"
                  >
                    <div className="internal-kpi-header">
                      <span className="internal-kpi-title">Tài khoản nội bộ</span>
                      <div className="internal-kpi-icon blue">
                        <ShieldCheck size={20} />
                      </div>
                    </div>
                    <div className="internal-kpi-value">
                      {overview ? (overview.accounts ?? 0) : '—'}
                    </div>
                    <div className="internal-kpi-footer">
                      <span>Phân quyền Admin & Manager</span>
                      <ArrowRight size={14} className="internal-kpi-arrow" />
                    </div>
                  </div>

                  <div
                    className="internal-kpi-card green"
                    role="button"
                    tabIndex={0}
                    onClick={() => go('/admin/products')}
                    title="Tra cứu danh mục sản phẩm"
                  >
                    <div className="internal-kpi-header">
                      <span className="internal-kpi-title">Sản phẩm</span>
                      <div className="internal-kpi-icon green">
                        <Package size={20} />
                      </div>
                    </div>
                    <div className="internal-kpi-value">
                      {overview ? (overview.products ?? 0) : '—'}
                    </div>
                    <div className="internal-kpi-footer">
                      <span>Sản phẩm trong cơ sở dữ liệu</span>
                      <ArrowRight size={14} className="internal-kpi-arrow" />
                    </div>
                  </div>

                  <div className="internal-kpi-card emerald">
                    <div className="internal-kpi-header">
                      <span className="internal-kpi-title">Hạ tầng hệ thống</span>
                      <div className="internal-kpi-icon emerald">
                        <Activity size={20} />
                      </div>
                    </div>
                    <div className="internal-kpi-value">100%</div>
                    <div className="internal-kpi-footer">
                      <span className="internal-live-indicator">
                        <i /> API & Database ổn định
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions Panel */}
                <div className="internal-section-card">
                  <div className="internal-card-head">
                    <div>
                      <h3>Lối tắt thao tác nhanh</h3>
                      <p>Truy cập trực tiếp các nghiệp vụ quản trị hệ thống</p>
                    </div>
                  </div>
                  <div className="internal-actions-grid">
                    <a
                      className="internal-action-item"
                      href="/admin/accounts"
                      onClick={followInternalLink}
                      title="Mở quản lý tài khoản nội bộ"
                    >
                      <div className="internal-action-icon blue">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="internal-action-text">
                        <b>Tài khoản nội bộ</b>
                        <small>Cấp tài khoản Admin & Manager, phân quyền và khóa tài khoản</small>
                      </div>
                      <ChevronRight size={16} className="internal-action-arrow" />
                    </a>

                    <a
                      className="internal-action-item"
                      href="/admin/products"
                      onClick={followInternalLink}
                      title="Mở tra cứu sản phẩm"
                    >
                      <div className="internal-action-icon green">
                        <Package size={20} />
                      </div>
                      <div className="internal-action-text">
                        <b>Tra cứu sản phẩm</b>
                        <small>Xem danh mục, giá bán và tồn kho</small>
                      </div>
                      <ChevronRight size={16} className="internal-action-arrow" />
                    </a>

                    <a
                      className="internal-action-item"
                      href={managerUrl}
                      title="Chuyển sang Cổng quản lý cửa hàng (Manager Portal)"
                    >
                      <div className="internal-action-icon amber">
                        <Layers size={20} />
                      </div>
                      <div className="internal-action-text">
                        <b>Cổng quản lý cửa hàng</b>
                        <small>
                          Chuyển sang Manager Portal để xử lý đơn hàng, khách hàng, voucher
                        </small>
                      </div>
                      <ChevronRight size={16} className="internal-action-arrow" />
                    </a>
                  </div>
                </div>

                {/* System Specifications & Security Policy */}
                <div className="internal-info-grid">
                  <div className="internal-section-card">
                    <div className="internal-card-head">
                      <div>
                        <h3>Thông số máy chủ & Bảo mật</h3>
                        <p>Thông tin cấu hình hạ tầng hiện tại</p>
                      </div>
                    </div>
                    <div className="internal-spec-list">
                      <div className="internal-spec-row">
                        <span className="spec-label">
                          <Server size={14} /> Máy chủ ứng dụng
                        </span>
                        <span className="spec-val">Spring Boot 3.4.3 (Java 21)</span>
                      </div>
                      <div className="internal-spec-row">
                        <span className="spec-label">
                          <Database size={14} /> Cơ sở dữ liệu
                        </span>
                        <span className="spec-val">PostgreSQL 16 Enterprise</span>
                      </div>
                      <div className="internal-spec-row">
                        <span className="spec-label">
                          <Lock size={14} /> Cơ chế xác thực
                        </span>
                        <span className="spec-val">HMAC-SHA256 JWT Token</span>
                      </div>
                      <div className="internal-spec-row">
                        <span className="spec-label">
                          <Shield size={14} /> Quyền hạn tài khoản
                        </span>
                        <span className="spec-val badge">ROOT_ADMINISTRATOR</span>
                      </div>
                    </div>
                  </div>

                  <div className="internal-section-card internal-security-card">
                    <div className="internal-card-head">
                      <div>
                        <h3>Chính sách an toàn thông tin</h3>
                        <p>Quy chuẩn vận hành tài khoản nội bộ</p>
                      </div>
                    </div>
                    <div className="internal-security-tips">
                      <div className="tip-item">
                        <CheckCircle2 size={16} className="tip-icon" />
                        <p>
                          <strong>Phân quyền tối thiểu:</strong> Chỉ cấp quyền <code>ADMIN</code>{' '}
                          cho người quản trị cấp cao. Nhân viên vận hành cấp quyền{' '}
                          <code>MANAGER</code>.
                        </p>
                      </div>
                      <div className="tip-item">
                        <CheckCircle2 size={16} className="tip-icon" />
                        <p>
                          <strong>Khóa tài khoản kịp thời:</strong> Khi nhân viên nghỉ việc hoặc có
                          dấu hiệu bất thường, sử dụng tính năng <em>Khóa tài khoản</em> trong trang
                          Tài khoản nội bộ.
                        </p>
                      </div>
                      <div className="tip-item">
                        <CheckCircle2 size={16} className="tip-icon" />
                        <p>
                          <strong>Đổi mật khẩu định kỳ:</strong> Sử dụng mật khẩu phức tạp trên 8 ký
                          tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : section === 'audit-logs' ? (
              <AuditLogs />
            ) : (
              menu[section] && <InternalDirectory key={section} kind={section} />
            )}
          </main>
        </>
      )}
      {error && (
        <div
          className="admin-card"
          role="alert"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 100,
            borderLeft: '4px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setRetry(n => n + 1)}>
            Thử lại
          </button>
        </div>
      )}
    </div>
  );
}
