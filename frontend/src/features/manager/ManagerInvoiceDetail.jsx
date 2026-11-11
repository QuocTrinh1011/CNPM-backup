import React, { useCallback, useEffect, useRef } from 'react';
import { Calendar, CreditCard, MapPin, Truck, User, X } from 'lucide-react';
import { adminEndpoints } from '../../api/manager-api';
import { useManagerList } from '../../shared/hooks/useManagerResource';
import { money, date, orderLabels, paymentLabels } from './ManagerOrderDetail';
import './manager-invoices.css';

const paymentMethods = { COD: 'Thanh toán khi nhận hàng', PAYOS: 'PayOS / VietQR' };

export default function ManagerInvoiceDetail({ orderId, onClose, focusTarget }) {
  const endpoint = useCallback(() => adminEndpoints.order(orderId), [orderId]);
  const { data: order, loading, error, load } = useManagerList(endpoint);
  const panel = useRef(null);
  const returnFocus = useRef(focusTarget);
  returnFocus.current = focusTarget || returnFocus.current;
  const close = () => onClose?.();

  useEffect(() => {
    panel.current?.querySelector('button')?.focus();
  }, [orderId, focusTarget]);

  useEffect(() => () => {
    const target = returnFocus.current;
    if (target?.isConnected) target.focus();
  }, []);

  const keyboard = event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); return; }
  };

  const subtotal = order ? Number(order.totalAmount || 0) + Number(order.discountAmount || 0) : 0;
  const discount = Number(order?.discountAmount || 0);
  return (
    <aside
      ref={panel}
      onKeyDown={keyboard}
      className="admin-order-detail invoice-detail-panel"
      role="region"
      aria-label="Chi tiết hóa đơn"
      tabIndex={-1}
    >
      <div className="admin-section-heading">
        <h2 id="invoice-detail-title">{order ? `Hóa đơn #${order.orderCode}` : 'Chi tiết hóa đơn'}</h2>
        <button aria-label="Đóng hóa đơn" className="admin-action" onClick={close}><X size={18} /></button>
      </div>
      {loading && !order ? (
        <p role="status">Đang tải hóa đơn...</p>
      ) : error && !order ? (
        <div role="alert" className="invoice-error"><p>{error}</p><button className="admin-action" onClick={() => load()}>Thử lại</button></div>
      ) : order && (
        <>
            <div className="invoice-head">
              <span className={`admin-status admin-status-${(order.status || '').toLowerCase()}`}>
                <span className="admin-badge-dot" />
                {orderLabels[order.status] || order.status}
              </span>
              <span className={`invoice-payment-badge ${order.paymentStatus === 'PAID' ? 'is-paid' : ''}`}>
                {paymentLabels[order.paymentStatus] || order.paymentStatus || '—'}
              </span>
            </div>
            <div className="admin-detail-grid">
              <div>
                <span><User size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Khách hàng</span>
                <b>{order.customer?.fullName || '—'}</b>
                <small>{order.customer?.email || ''}</small>
              </div>
              <div>
                <span><Calendar size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Ngày lập</span>
                <b>{date(order.createdAt)}</b>
              </div>
              <div>
                <span><CreditCard size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Phương thức thanh toán</span>
                <b>{paymentMethods[order.paymentMethod] || order.paymentMethod || '—'}</b>
              </div>
              <div>
                <span><Truck size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Mã vận đơn</span>
                <b>{order.trackingCode || '—'}</b>
              </div>
              <div className="admin-detail-wide">
                <span><MapPin size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Địa chỉ giao hàng</span>
                <b>{order.deliveryAddress || '—'}</b>
              </div>
              {order.status === 'CANCELLED' && (
                <div className="admin-detail-wide admin-detail-cancel-box">
                  <span>Lý do hủy</span>
                  <b className="admin-cancel-reason">{order.cancelReason?.trim() || 'Chưa có lý do hủy'}</b>
                </div>
              )}
            </div>
            <h3>Sản phẩm</h3>
            <div className="invoice-items-wrap">
              <table className="invoice-items">
                <thead>
                  <tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
                </thead>
                <tbody>
                  {(order.items || []).map(item => {
                    const variant = [item.size, item.color].filter(Boolean).join(' / ');
                    return (
                      <tr key={item.id}>
                        <td data-label="Sản phẩm"><b>{item.product?.name || 'Sản phẩm'}</b>{variant && <small>{variant}</small>}</td>
                        <td data-label="SL">{item.quantity}</td>
                        <td data-label="Đơn giá">{money(item.unitPrice)}</td>
                        <td data-label="Thành tiền"><b>{money(Number(item.unitPrice || 0) * item.quantity)}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!order.items?.length && <p className="invoice-empty">Chưa có sản phẩm trong hóa đơn.</p>}
            </div>
            <div className="invoice-totals">
              <div><span>Tạm tính</span><b>{money(subtotal)}</b></div>
              <div><span>Giảm giá{order.voucherCode ? ` · ${order.voucherCode}` : ''}</span><b>{discount > 0 ? `-${money(discount)}` : money(0)}</b></div>
              <div className="invoice-total-row"><span>Tổng thanh toán</span><strong>{money(order.totalAmount)}</strong></div>
            </div>
            <p className="invoice-note">Hóa đơn chỉ dùng để tra cứu. Thao tác cập nhật trạng thái nằm ở trang Đơn hàng.</p>
          <div className="admin-dialog-actions"><button className="admin-action" onClick={close}>Đóng</button></div>
        </>
      )}
    </aside>
  );
}
