import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../api/manager-api';
import './manager-payment.css';

const money = value =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
const date = value => (value ? new Date(value).toLocaleString('vi-VN') : '—');
const reviewLabels = {
  PROVIDER_UNAVAILABLE: 'Không thể kết nối PayOS',
  PROVIDER_MISMATCH: 'Thông tin giao dịch không khớp',
  MULTIPLE_PAYMENTS: 'Phát hiện nhiều lần thanh toán',
  OVERPAYMENT: 'Số tiền đã trả cao hơn đơn hàng',
  PARTIAL_PAYMENT: 'PayOS ghi nhận thanh toán một phần',
  LOCAL_PROVIDER_CONFLICT: 'Trạng thái trong hệ thống khác PayOS',
  MISSING_PAYMENT: 'Không tìm thấy giao dịch thanh toán',
  MISSING_LINK: 'Không tìm thấy liên kết thanh toán',
  DUPLICATE_LINK: 'Phát hiện liên kết thanh toán trùng',
  UNMAPPED_LEGACY_LINK: 'Liên kết thanh toán cũ chưa được đối chiếu',
  CANCEL_NOT_CONFIRMED: 'PayOS chưa xác nhận hủy liên kết',
  INVALID_AMOUNT: 'Số tiền đơn hàng không hợp lệ',
  UNKNOWN_PROVIDER_STATUS: 'PayOS trả về trạng thái chưa xác định',
};

export default function ManagerPaymentPanel({ order, onUpdated, onEditingChange }) {
  const [mode, setMode] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const sending = useRef(false);
  const finance = order.finance || {};

  useEffect(() => {
    onEditingChange?.(mode || busy);
    return () => onEditingChange?.(false);
  }, [mode, busy, onEditingChange]);

  const refresh = async () => {
    try {
      onUpdated(await adminApi(`/api/manager/orders/${order.id}`));
    } catch {
      setFailure('Đã lưu, nhưng chưa tải lại được chi tiết. Vui lòng tải lại trang.');
    }
  };

  const submitCod = async event => {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailure('');
    try {
      await adminApi(`/api/manager/orders/${order.id}/cod-collection`, {
        method: 'PATCH',
        body: { note: note.trim() },
      });
      setMode(false);
      setNote('');
      await refresh();
    } catch (error) {
      setFailure(error.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const reconcile = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailure('');
    try {
      onUpdated(
        await adminApi(`/api/manager/orders/${order.id}/payment/reconcile`, { method: 'POST' }),
      );
    } catch (error) {
      setFailure(error.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="manager-payment-panel" aria-label="Thanh toán và đối soát">
      <h3>Thanh toán và đối soát</h3>
      {finance.reviewRequired && (
        <div role="status" className="manager-payment-warning">
          <strong>Cần kiểm tra thanh toán</strong>
          <p>{reviewLabels[finance.reviewReason] || 'Cần đối chiếu thông tin giao dịch.'}</p>
          <small>{date(finance.reviewAt)}</small>
        </div>
      )}
      {order.paymentMethod === 'PAYOS' && (
        <button type="button" className="admin-action" disabled={busy || mode} onClick={reconcile}>
          Đối chiếu lại PayOS
        </button>
      )}
      {finance.codCollectedAt && <p>Đã xác nhận thu toàn bộ COD: {date(finance.codCollectedAt)}</p>}
      {order.paymentMethod === 'COD' &&
        ['DELIVERED', 'COMPLETED'].includes(order.status) &&
        !finance.codCollectedAt &&
        !mode && (
          <button
            type="button"
            className="admin-action"
            disabled={busy}
            onClick={() => {
              setFailure('');
              setMode(true);
            }}
          >
            Xác nhận đã thu COD
          </button>
        )}
      {order.status === 'CANCELLED' && order.paymentStatus === 'PAID' && (
        <p className="manager-payment-note">
          Đơn đã thanh toán trước khi hủy. Hệ thống không tự xử lý khoản tiền đã thu; cần cửa hàng
          đối soát thủ công.
        </p>
      )}
      {mode && (
        <form className="manager-payment-form" aria-label="Xác nhận thu COD" onSubmit={submitCod}>
          <h4>Xác nhận đã thu {money(order.totalAmount)}</h4>
          <p>Chỉ xác nhận sau khi đã kiểm tra thực tế tiền thu.</p>
          <label>
            Ghi chú
            <textarea
              autoFocus
              required
              maxLength={1000}
              value={note}
              disabled={busy}
              onChange={event => setNote(event.target.value)}
            />
          </label>
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(false);
                setFailure('');
              }}
            >
              Bỏ qua
            </button>
            <button className="admin-primary" disabled={busy || !note.trim()}>
              {busy ? 'Đang lưu…' : 'Xác nhận'}
            </button>
          </div>
        </form>
      )}
      {failure && <p role="alert">{failure}</p>}
    </section>
  );
}
