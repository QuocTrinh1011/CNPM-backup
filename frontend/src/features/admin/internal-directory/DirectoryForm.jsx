import React, { useEffect, useId, useRef } from 'react';

export function DirectoryForm({ form, save, labels, kind, promotingEmployee, setForm, busy, customerAccount, error }) {
  const modal = kind === 'accounts' && !!form;
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('input')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [modal]);
  const close = () => { if (!busy) setForm(null); };
  const onKeyDown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('input:not(:disabled),select:not(:disabled),button:not(:disabled)')];
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const content = (
    <>
      {form && (
        <form className={`internal-filters${modal ? ' admin-account-form' : ''}`} onSubmit={save} style={modal ? undefined : { margin: '20px 0', border: '2px solid var(--admin-primary)', borderRadius: '12px', background: 'var(--admin-card)', padding: '24px' }}>
          {!modal && <div style={{ width: '100%', marginBottom: '14px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700' }}>
              {form.id ? 'Chỉnh sửa thông tin' : 'Tạo mới dữ liệu'}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--admin-muted)' }}>
              Điền các thông tin cần thiết vào biểu mẫu bên dưới.
            </p>
          </div>}
          {modal && error && <p role="alert" className="admin-account-error">{error}</p>}

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

          <div className={modal ? 'admin-dialog-actions' : undefined} style={{ width: '100%', display: 'flex', gap: '10px', marginTop: '12px' }}>
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
  if (!modal) return content;
  return (
    <div className="admin-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} className="admin-dialog admin-account-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="admin-account-dialog-header">
          <h2 id={titleId}>{form.id ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}</h2>
          <button type="button" className="admin-dialog-close" aria-label="Đóng hộp thoại" disabled={busy} onClick={close}>×</button>
        </div>
        <p>Điền thông tin tài khoản rồi nhấn Lưu để hoàn tất.</p>
        {content}
      </section>
    </div>
  );
}
