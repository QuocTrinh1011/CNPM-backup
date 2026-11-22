import React from 'react';
import { CheckCircle2, Edit2, Lock, Trash2, XCircle } from 'lucide-react';
import { ROLE_CONFIG, WORK_AREA_LABELS } from './internalDirectoryConfig';

export function DirectoryTable({ data, error, kind, canEditCurrentGroup, page, setPage, busy, customerAccount, setPromotingEmployee, setForm, toggleCustomerLock, remove, suppliers = [] }) {
  const suppliersById = new Map(suppliers.map((supplier) => [String(supplier.id), supplier]));
  return (
    <>
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
                          <small className="internal-directory-row-meta">
                            {row.category || 'Chưa phân loại'} ·{' '}
                            {suppliersById.get(String(row.supplierId))
                              ? `${suppliersById.get(String(row.supplierId)).code} · ${suppliersById.get(String(row.supplierId)).name}`
                              : row.supplierId ? `NCC #${row.supplierId}` : 'Chưa gán nhà cung cấp'}
                          </small>
                        </span>
                      ) : kind === 'accounts' ? (
                        <span>
                          {row.email} ·{' '}
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: ROLE_CONFIG[row.role]?.bg || 'rgba(37, 99, 235, 0.15)', color: ROLE_CONFIG[row.role]?.color || '#2563eb' }}>
                            {row.role === 'EMPLOYEE' ? WORK_AREA_LABELS[row.workArea] || WORK_AREA_LABELS.GENERAL : ROLE_CONFIG[row.role]?.label || row.role}
                          </span>
                          {row.preferences ? (
                            <span style={{ display: "block", fontSize: "11px", color: "var(--admin-muted)", marginTop: "2px" }}>
                              {row.preferences}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span>
                          {row.email || row.phone || 'Chưa có thông tin liên hệ'} {row.email && row.phone ? `· ${row.phone}` : ''}
                          {kind === 'suppliers' && row.address && (
                            <small className="internal-directory-row-meta">{row.address}</small>
                          )}
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
    </>
  );
}
