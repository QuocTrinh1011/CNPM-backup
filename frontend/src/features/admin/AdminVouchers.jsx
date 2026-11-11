import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, TicketPercent, Pencil, Power, Search, X } from 'lucide-react';
import { adminApi } from '../../api/manager-api';
import { useManagerList } from '../../shared/hooks/useManagerResource';
import './admin-vouchers.css';

const labels = {
  ACTIVE: 'Đang áp dụng',
  SCHEDULED: 'Sắp bắt đầu',
  EXPIRED: 'Đã hết hạn',
  EXHAUSTED: 'Hết lượt',
  DISABLED: 'Đã tắt',
};
const money = value => Number(value || 0).toLocaleString('vi-VN') + ' đ';
const empty = () => ({
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  minOrderAmount: '0',
  maxDiscountAmount: '',
  usageLimit: '',
  perCustomerLimit: '1',
  startsAt: '',
  expiresAt: '',
  active: true,
});
const localDate = value => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const displayDate = value => (value ? new Date(value).toLocaleString('vi-VN') : 'Không giới hạn');

export default function AdminVouchers() {
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [state, setState] = useState('');
  const [actionError, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const [form, setForm] = useState(null),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(''),
    [notice, setNotice] = useState('');
  const lock = useRef(false);
  const endpoint = useCallback(
    () => '/api/manager/vouchers?' + new URLSearchParams({ page, size: 10, search: query, state }),
    [page, query, state, revision],
  );
  const { data, loading, error: loadError } = useManagerList(endpoint);
  const error = actionError || loadError;
  useEffect(() => {
    if (!form) return;
    const handleKeyDown = e => {
      if (e.key === 'Escape' && !busy) {
        setForm(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form, busy]);

  const start = voucher => {
    setEditing(voucher || null);
    setFormError('');
    setNotice('');
    setForm(
      voucher
        ? {
            ...empty(),
            ...voucher,
            maxDiscountAmount: voucher.maxDiscountAmount ?? '',
            usageLimit: voucher.usageLimit ?? '',
            perCustomerLimit: voucher.perCustomerLimit ?? '',
            startsAt: localDate(voucher.startsAt),
            expiresAt: localDate(voucher.expiresAt),
          }
        : empty(),
    );
  };
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const save = async event => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFormError('');
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: Number(form.minOrderAmount),
        maxDiscountAmount:
          form.discountType === 'PERCENTAGE' && form.maxDiscountAmount !== ''
            ? Number(form.maxDiscountAmount)
            : null,
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        perCustomerLimit: form.perCustomerLimit === '' ? null : Number(form.perCustomerLimit),
        active: form.active,
      };
      await adminApi('/api/manager/vouchers' + (editing ? '/' + editing.id : ''), {
        method: editing ? 'PATCH' : 'POST',
        body: payload,
      });
      setForm(null);
      setNotice('Đã lưu mã giảm giá.');
      setRevision(value => value + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const toggle = async voucher => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await adminApi('/api/manager/vouchers/' + voucher.id, {
        method: 'PATCH',
        body: { active: !voucher.active },
      });
      setRevision(value => value + 1);
      setNotice(voucher.active ? 'Đã tắt mã giảm giá.' : 'Đã bật mã giảm giá.');
    } catch (err) {
      setError(err.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="admin-panel admin-vouchers">
      <div className="admin-voucher-heading">
        <div>
          <h2>
            <TicketPercent size={22} /> Mã giảm giá
          </h2>
          <p>Tạo ưu đãi cho COD và PayOS. Mỗi đơn dùng một mã.</p>
        </div>
        <button className="admin-primary" disabled={busy} onClick={() => start(null)}>
          <Plus size={16} /> Tạo mã
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {form && (
        <div className="admin-dialog-backdrop" onClick={() => !busy && setForm(null)}>
          <div
            className="admin-dialog admin-voucher-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-dialog-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="admin-dialog-header">
              <div className="admin-dialog-header-title">
                <TicketPercent size={20} className="admin-dialog-icon" />
                <h2 id="voucher-dialog-title">
                  {editing ? 'Chỉnh sửa mã ' + editing.code : 'Tạo mã giảm giá mới'}
                </h2>
              </div>
              <button
                type="button"
                className="admin-dialog-close"
                aria-label="Đóng"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                <X size={18} />
              </button>
            </div>
            {formError && (
              <p role="alert" className="admin-voucher-error">
                {formError}
              </p>
            )}
            <form className="admin-voucher-editor-form" onSubmit={save}>
              <fieldset disabled={busy}>
                <div className="admin-voucher-fields">
                  <label>
                    Mã giảm giá
                    <input
                      required
                      maxLength={40}
                      pattern="[A-Za-z0-9_-]{1,40}"
                      disabled={!!editing}
                      value={form.code}
                      onChange={e => change('code', e.target.value.toUpperCase())}
                      placeholder="VD: SHOP10"
                    />
                  </label>
                  <label>
                    Loại giảm
                    <select
                      value={form.discountType}
                      onChange={e => change('discountType', e.target.value)}
                    >
                      <option value="PERCENTAGE">Theo phần trăm (%)</option>
                      <option value="FIXED_AMOUNT">Số tiền cố định (đ)</option>
                    </select>
                  </label>
                  <label>
                    Giá trị giảm
                    <input
                      required
                      type="number"
                      min={form.discountType === 'PERCENTAGE' ? '0.01' : '1'}
                      max={form.discountType === 'PERCENTAGE' ? 100 : 9999999999}
                      step={form.discountType === 'PERCENTAGE' ? '0.01' : '1'}
                      value={form.discountValue}
                      onChange={e => change('discountValue', e.target.value)}
                    />
                  </label>
                  <label>
                    Đơn tối thiểu (đ)
                    <input
                      required
                      type="number"
                      min="0"
                      max="9999999999"
                      step="1"
                      value={form.minOrderAmount}
                      onChange={e => change('minOrderAmount', e.target.value)}
                    />
                  </label>
                  {form.discountType === 'PERCENTAGE' && (
                    <label>
                      Giảm tối đa (đ)
                      <input
                        type="number"
                        min="1"
                        max="9999999999"
                        step="1"
                        placeholder="Không giới hạn"
                        value={form.maxDiscountAmount}
                        onChange={e => change('maxDiscountAmount', e.target.value)}
                      />
                    </label>
                  )}
                  <label>
                    Tổng lượt sử dụng
                    <input
                      type="number"
                      min={Math.max(1, editing?.usedCount || 0)}
                      max="2147483647"
                      step="1"
                      placeholder="Không giới hạn"
                      value={form.usageLimit}
                      onChange={e => change('usageLimit', e.target.value)}
                    />
                  </label>
                  <label>
                    Tối đa mỗi khách
                    <input
                      type="number"
                      min="1"
                      max="2147483647"
                      step="1"
                      placeholder="Không giới hạn"
                      value={form.perCustomerLimit}
                      onChange={e => change('perCustomerLimit', e.target.value)}
                    />
                  </label>
                  {editing &&
                    editing.usedCount > 0 &&
                    form.perCustomerLimit !== '' &&
                    (editing.perCustomerLimit == null ||
                      Number(form.perCustomerLimit) < editing.perCustomerLimit) && (
                      <p role="status">
                        Giảm giới hạn chỉ áp dụng cho lượt đặt mới. Khách đã dùng đến/vượt giới hạn
                        mới không dùng thêm được; đơn đã tạo giữ nguyên.
                      </p>
                    )}
                  <label>
                    Bắt đầu (giờ địa phương)
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={e => change('startsAt', e.target.value)}
                    />
                  </label>
                  <label>
                    Kết thúc (giờ địa phương)
                    <input
                      type="datetime-local"
                      value={form.expiresAt}
                      onChange={e => change('expiresAt', e.target.value)}
                    />
                  </label>
                  <label className="admin-voucher-description">
                    Mô tả
                    <textarea
                      maxLength={1000}
                      rows={2}
                      value={form.description || ''}
                      onChange={e => change('description', e.target.value)}
                      placeholder="Mô tả ưu đãi..."
                    />
                  </label>
                </div>
                <label className="admin-voucher-check">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => change('active', e.target.checked)}
                  />
                  Bật áp dụng khi đủ điều kiện
                </label>
                <div className="admin-dialog-actions admin-voucher-actions">
                  <button
                    type="button"
                    className="admin-dialog-cancel"
                    disabled={busy}
                    onClick={() => setForm(null)}
                  >
                    <X size={16} /> Đóng
                  </button>
                  <button type="submit" className="admin-primary" disabled={busy}>
                    {busy ? 'Đang lưu...' : 'Lưu mã'}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}
      <div className="admin-voucher-toolbar">
        <form
          onSubmit={e => {
            e.preventDefault();
            setQuery(search.trim());
            setPage(0);
          }}
        >
          <input
            aria-label="Tìm mã giảm giá"
            value={search}
            maxLength={40}
            placeholder="Tìm theo mã..."
            onChange={e => setSearch(e.target.value)}
          />
          <button className="admin-action" aria-label="Tìm kiếm">
            <Search size={18} />
          </button>
        </form>
        <label>
          Trạng thái
          <select
            value={state}
            onChange={e => {
              setState(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả</option>
            {Object.entries(labels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <div role="alert" className="admin-voucher-error">
          {error}{' '}
          <button className="admin-action" onClick={() => setRevision(value => value + 1)}>
            Thử lại
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Đang tải mã giảm giá...</p>
      ) : (
        !error &&
        (!data?.content?.length ? (
          <p>Chưa có mã giảm giá phù hợp.</p>
        ) : (
          <>
            <div className="admin-voucher-table">
              <table>
                <thead>
                  <tr>
                    <th>Mã / Ưu đãi</th>
                    <th>Điều kiện</th>
                    <th>Thời gian</th>
                    <th>Lượt / Tiền giảm</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.content.map(v => (
                    <tr key={v.id}>
                      <td data-label="Mã / Ưu đãi">
                        <strong>{v.code}</strong>
                        <span>
                          {v.discountType === 'PERCENTAGE'
                            ? v.discountValue + '%'
                            : money(v.discountValue)}
                        </span>
                        <small>{v.description}</small>
                      </td>
                      <td data-label="Điều kiện">
                        <span>Đơn từ {money(v.minOrderAmount)}</span>
                        {v.maxDiscountAmount != null && (
                          <small>Giảm tối đa {money(v.maxDiscountAmount)}</small>
                        )}
                      </td>
                      <td data-label="Thời gian">
                        <small>Từ: {v.startsAt ? displayDate(v.startsAt) : 'Ngay khi bật'}</small>
                        <small>Đến: {displayDate(v.expiresAt)}</small>
                      </td>
                      <td data-label="Lượt / Tiền giảm">
                        <span>
                          {v.usedCount} / {v.usageLimit ?? '∞'} lượt
                        </span>
                        <small>Mỗi khách: {v.perCustomerLimit ?? 'Không giới hạn'} lượt</small>
                        <small>{money(v.totalDiscount)} đã giảm*</small>
                      </td>
                      <td data-label="Trạng thái">
                        <span
                          className={
                            'admin-voucher-badge ' + (v.state === 'ACTIVE' ? 'is-active' : '')
                          }
                        >
                          {labels[v.state] || v.state}
                        </span>
                      </td>
                      <td data-label="Thao tác">
                        <div className="admin-voucher-actions">
                          <button className="admin-action" disabled={busy} onClick={() => start(v)}>
                            <Pencil size={15} /> Sửa
                          </button>
                          <button
                            className="admin-action"
                            disabled={busy}
                            onClick={() => toggle(v)}
                          >
                            <Power size={15} /> {v.active ? 'Tắt' : 'Bật'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="admin-voucher-note">
              * Tổng tiền giảm trên đơn chưa hủy; lượt được hoàn khi hủy đơn có lịch sử sử dụng
              voucher mới.
            </p>
          </>
        ))
      )}
      <div className="admin-pagination">
        <button disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>
          Trước
        </button>
        <span>
          Trang {page + 1} / {Math.max(1, data?.totalPages || 0)}
        </span>
        <button
          disabled={loading || page + 1 >= (data?.totalPages || 0)}
          onClick={() => setPage(value => value + 1)}
        >
          Sau
        </button>
      </div>
    </section>
  );
}
