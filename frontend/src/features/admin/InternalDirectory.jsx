import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/api';
import { adminApi as managerApi } from '../../api/manager-api';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Package,
  Truck,
  Lock
} from 'lucide-react';

const ROLE_CONFIG = {
  ADMIN: { label: 'Admin hệ thống', bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' },
  MANAGER_SALES: { label: 'Quản lý Bán hàng', bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' },
  MANAGER_WAREHOUSE: { label: 'Quản lý Kho', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  MANAGER_HR: { label: 'Quản lý Nhân sự', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
  EMPLOYEE: { label: 'Nhân viên', bg: 'rgba(148, 163, 184, 0.15)', color: '#64748b' },
  CUSTOMER: { label: 'Khách hàng', bg: 'rgba(20, 184, 166, 0.15)', color: '#0f9f91' },
  MANAGER: { label: 'Quản lý cửa hàng', bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' },
};
const WORK_AREA_LABELS = {
  SALES: 'Nhân viên bán hàng',
  WAREHOUSE: 'Nhân viên kho',
  GENERAL: 'Nhân viên chưa phân loại',
};
const ACCOUNT_GROUPS = [
  { id: 'managers', label: 'Tài khoản quản lý', title: 'Tài khoản quản lý', description: 'Admin hệ thống và các vai trò Manager.' },
  { id: 'employees', label: 'Tài khoản nhân viên', title: 'Tài khoản nhân viên', description: 'Danh sách nhân viên nội bộ.' },
  { id: 'customers', label: 'Tài khoản khách hàng', title: 'Tài khoản khách hàng', description: 'Quản lý thông tin và trạng thái tài khoản khách hàng.' },
];

export default function InternalDirectory({ kind, manager = false }) {
  const api = manager ? managerApi : adminApi;
  const base = `/api/${manager ? 'manager' : 'admin'}/${kind}`;
  const [filters, setFilters] = useState({
    q: '',
    active: '',
    sort: kind === 'products' ? 'createdAt' : 'name',
    desc: 'false',
  });
  const [page, setPage] = useState(0);
  const [accountGroup, setAccountGroup] = useState('managers');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [promotingEmployee, setPromotingEmployee] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    const params = new URLSearchParams({ page, size: 15 });
    if (kind === 'accounts') params.set('group', accountGroup);
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '') params.set(k, v);
    });
    api(`${base}?${params}`)
      .then((v) => {
        if (alive) setData(v);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [base, api, page, filters, reload, kind, accountGroup]);

  const change = (k, v) => {
    setPage(0);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const customerAccount = kind === 'accounts' && accountGroup === 'customers';
      const body = customerAccount
        ? { fullName: form.fullName, email: form.email, phone: form.phone || null, preferences: form.preferences || null }
        : { ...form };
      if (kind === 'accounts' && body.role === 'EMPLOYEE') delete body.password;
      await api(customerAccount ? `/api/admin/customers/${form.id}` : form.id ? `${base}/${form.id}` : base, {
        method: customerAccount ? 'PUT' : form.id ? (kind === 'accounts' ? 'PATCH' : 'PUT') : 'POST',
        body,
      });
      setForm(null);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm('Vô hiệu hóa tài khoản này?')) return;
    setBusy(true);
    try {
      await api(`${base}/${row.id}`, { method: 'DELETE' });
      setPage(0);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleCustomerLock = async (row) => {
    const locked = !row.locked;
    const reason = locked ? window.prompt('Nhập lý do khóa tài khoản khách hàng:') : null;
    if (locked && (reason === null || !reason.trim())) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/customers/${row.id}/lock`, {
        method: 'PATCH',
        body: { locked, reason: locked ? reason.trim() : null },
      });
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const editable = kind === 'accounts' || (manager && kind === 'suppliers');
  const customerAccount = kind === 'accounts' && accountGroup === 'customers';
  const canCreateCurrentGroup = editable && !customerAccount;
  const canEditCurrentGroup = (editable && !customerAccount) || (customerAccount && !manager);
  const labels =
    customerAccount
      ? { fullName: 'Họ tên', email: 'Email', phone: 'Số điện thoại', preferences: 'Sở thích' }
      : kind === 'accounts'
      ? { fullName: 'Họ tên', email: 'Email', password: 'Mật khẩu mới' }
      : {
          code: 'Mã nhà cung cấp',
          name: 'Tên nhà cung cấp',
          email: 'Email',
          phone: 'Điện thoại',
          address: 'Địa chỉ',
          notes: 'Ghi chú',
        };

  const titles = {
    accounts: { title: 'Tài khoản nội bộ', desc: 'Quản trị Admin, các vai trò Manager và danh bạ nhân viên', icon: ShieldCheck },
    products: { title: 'Tra cứu sản phẩm', desc: 'Xem danh mục, giá bán và số lượng tồn kho', icon: Package },
    suppliers: { title: 'Nhà cung cấp', desc: 'Quản lý thông tin liên hệ và đối tác phân phối hàng hóa', icon: Truck },
  };

  const currentMeta = titles[kind] || { title: kind, desc: '', icon: Package };
  const accountMeta = ACCOUNT_GROUPS.find((group) => group.id === accountGroup) || ACCOUNT_GROUPS[0];
  const heading = kind === 'accounts' ? accountMeta.title : currentMeta.title;
  const description = kind === 'accounts' ? accountMeta.description : currentMeta.desc;
  const KindIcon = currentMeta.icon;

  return (
    <section className="admin-card internal-directory-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--admin-primary-soft)', color: 'var(--admin-primary)', display: 'grid', placeItems: 'center' }}>
              <KindIcon size={18} />
            </span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
              {kind === 'accounts'
                ? heading
                : kind === 'products'
                ? 'Tra cứu sản phẩm'
                : 'Nhà cung cấp'}
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--admin-muted)' }}>{description}</p>
        </div>

        {canCreateCurrentGroup && (
          <button
            type="button"
            className="admin-primary-btn"
            onClick={() => {
              setPromotingEmployee(false);
              setForm(
                kind === 'accounts'
                  ? { fullName: '', email: '', password: '', role: accountGroup === 'employees' ? 'EMPLOYEE' : 'MANAGER_SALES', workArea: '', locked: false }
                  : { code: '', name: '', email: '', phone: '', address: '', notes: '', active: true }
              );
            }}
          >
            <Plus size={16} /> Thêm mới
          </button>
        )}
      </div>

      {kind === 'accounts' && (
        <div className="admin-account-tabs" role="tablist" aria-label="Nhóm tài khoản">
          {ACCOUNT_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={accountGroup === group.id}
              className={accountGroup === group.id ? 'admin-account-tab is-active' : 'admin-account-tab'}
              onClick={() => {
                setAccountGroup(group.id);
                setPage(0);
                setForm(null);
              }}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="internal-filters">
        <label>
          Tìm kiếm
          <input
            value={filters.q}
            placeholder="Nhập từ khóa cần tìm..."
            onChange={(e) => change('q', e.target.value)}
          />
        </label>

        {kind !== 'accounts' && (
          <>
            <label>
              Trạng thái
              <select value={filters.active} onChange={(e) => change('active', e.target.value)}>
                <option value="">Tất cả</option>
                <option value="true">Hoạt động</option>
                <option value="false">Ngừng hoạt động</option>
              </select>
            </label>
            <label>
              Sắp xếp
              <select value={filters.sort} onChange={(e) => change('sort', e.target.value)}>
                {(kind === 'products'
                  ? ['name', 'createdAt', 'price', 'stock']
                  : ['name', 'createdAt']
                ).map((k) => (
                  <option key={k} value={k}>
                    {{ name: 'Tên', createdAt: 'Ngày tạo', price: 'Giá', stock: 'Tồn kho' }[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thứ tự
              <select value={filters.desc} onChange={(e) => change('desc', e.target.value)}>
                <option value="false">Tăng dần</option>
                <option value="true">Giảm dần</option>
              </select>
            </label>
          </>
        )}

        {kind === 'products' && (
          <>
            {Object.entries({
              category: 'Danh mục',
              minPrice: 'Giá từ',
              maxPrice: 'Giá đến',
            }).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  type={k === 'category' ? 'text' : 'number'}
                  min="0"
                  onChange={(e) => change(k, e.target.value)}
                />
              </label>
            ))}
            <label>
              Tồn kho
              <select onChange={(e) => change('stock', e.target.value)}>
                <option value="">Tất cả</option>
                <option value="IN_STOCK">Còn hàng</option>
                <option value="OUT">Hết hàng</option>
              </select>
            </label>
          </>
        )}
      </div>

      {error && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            Thử lại
          </button>
        </div>
      )}

      {/* Edit / Create Form Dialog */}
      {form && (
        <form className="internal-filters" onSubmit={save} style={{ margin: '20px 0', border: '2px solid var(--admin-primary)', borderRadius: '12px', background: 'var(--admin-card)', padding: '24px' }}>
          <div style={{ width: '100%', marginBottom: '14px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700' }}>
              {form.id ? 'Chỉnh sửa thông tin' : 'Tạo mới dữ liệu'}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--admin-muted)' }}>
              Điền các thông tin cần thiết vào biểu mẫu bên dưới.
            </p>
          </div>

          {Object.entries(labels).filter(([key]) => !(kind === 'accounts' && key === 'password' && form.role === 'EMPLOYEE')).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                required={
                  ['fullName', 'name', 'code'].includes(key) ||
                  (kind === 'accounts' && key === 'email') ||
                  (key === 'password' && form.role !== 'EMPLOYEE' && (!form.id || promotingEmployee))
                }
                value={form[key] || ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}

          {kind === 'accounts' && !customerAccount ? (
            <>
              <label>
                Vai trò
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="MANAGER_HR">Manager Nhân sự</option>
                  <option value="MANAGER_WAREHOUSE">Manager Kho</option>
                  <option value="MANAGER_SALES">Manager Bán hàng</option>
                  <option value="EMPLOYEE">Nhân viên</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              {form.role === 'EMPLOYEE' && (
                <label>
                  Loại nhân viên
                  <select
                    required
                    value={form.workArea === 'GENERAL' ? '' : form.workArea || ''}
                    onChange={(e) => setForm({ ...form, workArea: e.target.value })}
                  >
                    <option value="">Chọn loại nhân viên</option>
                    <option value="SALES">Nhân viên bán hàng</option>
                    <option value="WAREHOUSE">Nhân viên kho</option>
                  </select>
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'row', cursor: 'pointer', alignSelf: 'center', marginTop: '16px' }}>
                <input
                  type="checkbox"
                  checked={form.locked}
                  onChange={(e) => setForm({ ...form, locked: e.target.checked })}
                />
                Khóa tài khoản
              </label>
            </>
          ) : kind !== 'accounts' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'row', cursor: 'pointer', alignSelf: 'center', marginTop: '16px' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Đang hoạt động
            </label>
          ) : null}

          <div style={{ width: '100%', display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button disabled={busy} type="submit">
              {busy ? 'Đang lưu...' : 'Lưu'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setForm(null)}
              style={{ background: 'transparent', color: 'var(--admin-muted)' }}
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* Directory Table */}
      {!data && !error ? (
        <p role="status" style={{ padding: '30px', textAlign: 'center', color: 'var(--admin-muted)' }}>
          Đang tải dữ liệu...
        </p>
      ) : data ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {['Mã', 'Tên', 'Thông tin', 'Trạng thái', ...(canEditCurrentGroup ? ['Thao tác'] : [])].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.content.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: 'var(--admin-input)', color: 'var(--admin-primary)', border: '1px solid var(--admin-border)' }}>
                        {row.code || row.id}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600' }}>{row.fullName || row.name}</td>
                    <td>
                      {kind === 'products' ? (
                        <span>
                          <strong>{Number(row.price).toLocaleString('vi-VN')} đ</strong> · Tồn: {row.stock}
                        </span>
                      ) : kind === 'accounts' ? (
                        <span>
                          {row.email} ·{' '}
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: ROLE_CONFIG[row.role]?.bg || 'rgba(37, 99, 235, 0.15)', color: ROLE_CONFIG[row.role]?.color || '#2563eb' }}>
                            {row.role === 'EMPLOYEE' ? WORK_AREA_LABELS[row.workArea] || WORK_AREA_LABELS.GENERAL : ROLE_CONFIG[row.role]?.label || row.role}
                          </span>
                        </span>
                      ) : (
                        <span>
                          {row.email || ''} {row.phone ? `· ${row.phone}` : ''}
                        </span>
                      )}
                    </td>
                    <td>
                      {kind === 'accounts' ? (
                        row.locked ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: '600', fontSize: '12px' }}>
                            <Lock size={12} /> Đã khóa
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: '600', fontSize: '12px' }}>
                            <CheckCircle2 size={12} /> Hoạt động
                          </span>
                        )
                      ) : row.active ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: '600', fontSize: '12px' }}>
                          <CheckCircle2 size={12} /> Hoạt động
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: '600', fontSize: '12px' }}>
                          <XCircle size={12} /> Ngừng hoạt động
                        </span>
                      )}
                    </td>
                    {canEditCurrentGroup && <td>
                      {customerAccount ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setPromotingEmployee(false);
                              setForm({ ...row, password: '' });
                            }}
                            title="Sửa thông tin khách hàng"
                          >
                            <Edit2 size={13} /> Sửa
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleCustomerLock(row)}
                            title={row.locked ? 'Mở khóa tài khoản khách hàng' : 'Khóa tài khoản khách hàng'}
                            style={{ color: row.locked ? '#10b981' : '#ef4444' }}
                          >
                            <Lock size={13} /> {row.locked ? 'Mở khóa' : 'Khóa tài khoản'}
                          </button>
                        </>
                      ) : !(kind === 'accounts' && row.role === 'ADMIN') && <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setPromotingEmployee(row.role === 'EMPLOYEE');
                            setForm({ ...row, password: '' });
                          }}
                          title="Sửa thông tin"
                        >
                          <Edit2 size={13} /> Sửa
                        </button>
                      {kind === 'accounts' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => remove(row)}
                          title="Vô hiệu hóa tài khoản"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={13} /> Xóa mềm
                        </button>
                      )}
                      </>}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!data.content.length && (
            <p style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--admin-muted)', fontSize: '14px' }}>
              Chưa có dữ liệu phù hợp.
            </p>
          )}

          <div
            className="internal-filters"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              padding: '12px 18px',
            }}
          >
            <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
              Trang trước
            </button>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--admin-muted)' }}>
              {page + 1}/{Math.max(1, data.totalPages)}
            </span>
            <button disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Trang sau
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
