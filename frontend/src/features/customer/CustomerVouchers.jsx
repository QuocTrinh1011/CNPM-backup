import React, { useEffect, useRef, useState } from 'react';
import { useShopResource } from '../../shared/hooks/storefront-hooks';
const money = value =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
const states = {
  ACTIVE: 'Còn sử dụng',
  USED: 'Đã dùng',
  EXPIRED: 'Hết hạn',
  DISABLED: 'Đã tắt',
  EXHAUSTED: 'Đã dùng',
  SCHEDULED: 'Chưa đến hạn',
};
export function RewardSummary({ reward }) {
  if (!reward?.enabled) return null;
  return (
    <p className="shop-voucher-applied">
      Hoàn thành để nhận giảm{' '}
      {reward.discountType === 'PERCENTAGE'
        ? `${reward.discountValue}%`
        : money(reward.discountValue)}{' '}
      · Đơn từ {money(reward.minOrderAmount)}
      {reward.maxDiscountAmount ? ` · Giảm tối đa ${money(reward.maxDiscountAmount)}` : ''} · Có hạn{' '}
      {reward.validDays} ngày từ khi nhận.
    </p>
  );
}
export default function CustomerVouchers({ onSelect, subtotal }) {
  const [copyNotice, setCopyNotice] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const copy = async code => {
    try {
      await navigator.clipboard.writeText(code);
      if (alive.current) setCopyNotice(`Đã sao chép ${code}`);
    } catch {
      if (alive.current)
        setCopyNotice('Không sao chép được. Bạn có thể chọn và sao chép mã thủ công.');
    }
  };
  const [page, setPage] = useState(0);
  const { data, error, load } = useShopResource(`/api/customers/me/vouchers?page=${page}&size=10`);
  return (
    <section className="customer-page-body shop-wallet">
      <h2>Voucher của tôi</h2>
      {copyNotice && <p role="status">{copyNotice}</p>}
      {error ? (
        <div role="alert">
          {error}
          <button type="button" onClick={load}>
            Thử lại
          </button>
        </div>
      ) : !data ? (
        <p role="status">Đang tải voucher...</p>
      ) : (
        <>
          {!data.content?.length && (
            <p>
              Chưa có voucher khả dụng. Hãy quay lại khi cửa hàng có ưu đãi mới hoặc hoàn thành khảo
              sát có phần thưởng.
            </p>
          )}
          {(data.content || []).map(v => (
            <article className="shop-wallet-card" key={v.code}>
              <p>{v.source === 'GENERAL' ? 'Ưu đãi cửa hàng' : 'Thưởng khảo sát'}</p>
              <h3>
                {v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : money(v.discountValue)}
              </h3>
              <b>{v.code}</b>
              <p>{v.description}</p>
              <p>
                Đơn tối thiểu {money(v.minOrderAmount)}
                {v.maxDiscountAmount ? ` · Giảm tối đa ${money(v.maxDiscountAmount)}` : ''}
              </p>
              <p>
                Hạn dùng:{' '}
                {v.expiresAt ? new Date(v.expiresAt).toLocaleString('vi-VN') : 'Không giới hạn'} ·{' '}
                {states[v.state] || v.state}
              </p>
              {v.perCustomerLimit != null && (
                <p>
                  Mỗi tài khoản: {v.customerUses ?? 0} / {v.perCustomerLimit} lượt · Còn{' '}
                  {v.customerRemaining ?? 0} lượt
                </p>
              )}
              {v.unavailableReason === 'VOUCHER_PER_CUSTOMER_LIMIT' && (
                <p className="shop-field-error">Bạn đã dùng hết lượt của mã này.</p>
              )}
              {subtotal !== undefined && subtotal < Number(v.minOrderAmount || 0) && (
                <p className="shop-field-error">
                  Cần thêm {money(Number(v.minOrderAmount) - subtotal)} để đạt đơn tối thiểu.
                </p>
              )}
              <button className="button button-light" type="button" onClick={() => copy(v.code)}>
                Sao chép mã
              </button>
              {onSelect && (
                <button
                  className="button button-light"
                  type="button"
                  disabled={v.state !== 'ACTIVE' || v.selectable === false}
                  onClick={() => onSelect(v.code)}
                >
                  Chọn mã
                </button>
              )}
            </article>
          ))}
          <div className="order-actions">
            <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Trang trước
            </button>
            <span>
              Trang {page + 1} / {Math.max(1, data.totalPages || 0)}
            </span>
            <button
              type="button"
              disabled={page + 1 >= (data.totalPages || 0)}
              onClick={() => setPage(p => p + 1)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}
