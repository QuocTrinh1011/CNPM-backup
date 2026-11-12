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
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    const params = new URLSearchParams({ page, size: 15 });
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
  }, [base, api, page, filters, reload]);

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
      await api(form.id ? `${base}/${form.id}` : base, {
        method: form.id ? (kind === 'accounts' ? 'PATCH' : 'PUT') : 'POST',
        body: form,
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

  const editable = kind === 'accounts' || (manager && kind === 'suppliers');
  const labels =
    kind === 'accounts'
      ? { fullName: 'Họ tên', email: 'Email', password: 'Mật khẩu (để trống nếu không đổi)' }
      : {
          code: 'Mã nhà cung cấp',
          name: 'Tên nhà cung cấp',
          email: 'Email',
          phone: 'Điện thoại',
          address: 'Địa chỉ',
          notes: 'Ghi chú',
        };

  const titles = {
    accounts: { title: 'Tài khoản nội bộ', desc: 'Quản trị danh sách quản trị viên và nhân viên vận hành hệ thống', icon: ShieldCheck },
    products: { title: 'Tra cứu sản phẩm', desc: 'Xem danh mục, giá bán và số lượng tồn kho', icon: Package },
    suppliers: { title: 'Nhà cung cấp', desc: 'Quản lý thông tin liên hệ và đối tác phân phối hàng hóa', icon: Truck },
  };

  const currentMeta = titles[kind] || { title: kind, desc: '', icon: Package };
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
                ? 'Tài khoản nội bộ'
                : kind === 'products'
                ? 'Tra cứu sản phẩm'
                : 'Nhà cung cấp'}
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--admin-muted)' }}>{currentMeta.desc}</p>
        </div>

        {editable && (
          <button
            type="button"
            className="admin-primary-btn"
            onClick={() =>
              setForm(
                kind === 'accounts'
                  ? { fullName: '', email: '', password: '', role: 'MANAGER', locked: false }
                  : { code: '', name: '', email: '', phone: '', address: '', notes: '', active: true }
              )
            }
          >
            <Plus size={16} /> Thêm mới
          </button>
        )}
      </div>

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

          {Object.entries(labels).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                required={
                  ['fullName', 'name', 'code'].includes(key) ||
                  (kind === 'accounts' && key === 'email') ||
                  (key === 'password' && !form.id)
                }
                value={form[key] || ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}

          {kind === 'accounts' ? (
            <>
              <label>
                Vai trò
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option>MANAGER</option>
                  <option>ADMIN</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'row', cursor: 'pointer', alignSelf: 'center', marginTop: '16px' }}>
                <input
                  type="checkbox"
                  checked={form.locked}
                  onChange={(e) => setForm({ ...form, locked: e.target.checked })}
                />
                Khóa tài khoản
              </label>
            </>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'row', cursor: 'pointer', alignSelf: 'center', marginTop: '16px' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Đang hoạt động
            </label>
          )}

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
                  {['Mã', 'Tên', 'Thông tin', 'Trạng thái', 'Thao tác'].map((x) => (
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
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: row.role === 'ADMIN' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(37, 99, 235, 0.15)', color: row.role === 'ADMIN' ? '#8b5cf6' : '#2563eb' }}>
                            {row.role}
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
                    <td>
                      {editable && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setForm({ ...row, password: '' })}
                          title="Sửa thông tin"
                        >
                          <Edit2 size={13} /> Sửa
                        </button>
                      )}
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
                    </td>
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
