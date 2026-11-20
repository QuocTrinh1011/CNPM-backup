import React from 'react';

export function DirectoryForm({ form, save, labels, kind, promotingEmployee, setForm, busy, customerAccount }) {
  return (
    <>
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
    </>
  );
}
