import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from './api/manager-api';
import { useManagerReadPause } from './shared/hooks/useManagerResource';
import { showReturn, displayOrderLabel, deliveryLabel, returnLabels } from './shared/utils/order-display';
import './shared/styles/order-display.css';
import SourceCareCreator from './SourceCareCreator';
const OrderFinancePanel=React.lazy(()=>import('./ManagerRefunds').then(module=>({default:module.OrderFinancePanel})));
export { returnLabels } from './shared/utils/order-display';
import { X, User, Calendar, CreditCard, MapPin, RotateCcw, AlertTriangle } from 'lucide-react';

export const orderLabels = { PENDING: 'Chờ xác nhận', PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang chuẩn bị', SHIPPED: 'Đang giao', DELIVERING: 'Đang giao', DELIVERED: 'Đã giao — chờ khách xác nhận', COMPLETED: 'Khách đã nhận hàng', CANCELLED: 'Đã hủy' };
export const paymentLabels = { PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', COD: 'Thanh toán khi nhận hàng', EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy', FAILED: 'Thanh toán thất bại' };
export const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
export const date = value => value ? new Date(value).toLocaleString('vi-VN') : '—';

export default function ManagerOrderDetail({ detail: sourceDetail, loading, error, onRetry, onClose, onCancel }) {
  const [processed, setProcessed] = useState(null);
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [financeEditing,setFinanceEditing]=useState(false);
  const [failure, setFailure] = useState('');
  const detail = processed || sourceDetail;
  useManagerReadPause(!!action);
  useEffect(() => { setProcessed(null); }, [sourceDetail]);
  const actionLabels={APPROVED:'Chấp thuận đổi trả',REJECTED:'Từ chối đổi trả',COMPLETED:'Hoàn tất đổi trả'};
  const openAction = value => { setAction(value);setNote('');setFailure(''); };
  const close = () => { if(busy||financeEditing)return; if(action){setAction('');setFailure('');}else onClose(); };
  const process = async event => {
    event.preventDefault();if(busy)return;
    if(action!=='APPROVED' && !note.trim()){setFailure('Vui lòng nhập lý do hoặc ghi chú xử lý.');return;}
    setBusy(true);setFailure('');
    try { const updated=await adminApi(`/api/manager/orders/${detail.id}/return`,{method:'PATCH',body:{status:action,note:note.trim()}});setProcessed(updated);setAction(''); }
    catch(error){setFailure(error.status===404 && /No static resource.*\/return/i.test(error.message)
      ? 'Backend đang chạy phiên bản chưa có chức năng xử lý đổi trả. Cần khởi động lại backend bản mới; chạy migration thôi chưa đủ. Ghi chú của bạn vẫn được giữ để thử lại.'
      : error.message);}
    finally{setBusy(false);}
  };
  const dialog = useRef(null);
  useEffect(() => {
    if(action) dialog.current?.querySelector('textarea')?.focus();
    else dialog.current?.querySelector('button')?.focus();
  }, [action]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('button')?.focus();
    return () => previous?.isConnected && previous.focus();
  }, []);
  const keyboard = event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const nodes = [...dialog.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')];
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return (
    <div className="admin-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialog} onKeyDown={keyboard} className="admin-dialog admin-order-detail" role="dialog" aria-modal="true" aria-labelledby="admin-order-detail-title">
        <div className="admin-section-heading">
          <h2 id="admin-order-detail-title">Đơn hàng #{detail.orderCode || detail.id}</h2>
          <button aria-label="Đóng chi tiết" className="admin-action" disabled={busy||financeEditing} onClick={close}><X size={18}/></button>
        </div>
        {loading ? (
          <p role="status">Đang tải chi tiết...</p>
        ) : error ? (
          <div role="alert"><p>{error}</p><button onClick={onRetry}>Thử lại</button></div>
        ) : (
          <>
            <span className={`admin-status admin-status-${showReturn(detail) ? 'return-requested' : (detail.status || '').toLowerCase()}`}>
              <span className="admin-badge-dot" />
              {displayOrderLabel(detail, orderLabels)}
            </span>
            <div className="admin-detail-grid">
              {showReturn(detail) && <div><span>Trạng thái giao hàng</span><b>{deliveryLabel(detail, orderLabels)}</b></div>}
              <div>
                <span><User size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Khách hàng</span>
                <b>{detail.customer?.fullName || '—'}</b>
                <small>{detail.customer?.email || ''}</small>
              </div>
              <div>
                <span><Calendar size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Ngày đặt</span>
                <b>{date(detail.createdAt)}</b>
              </div>
              <div>
                <span><CreditCard size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Phương thức thanh toán</span>
                <b>{detail.paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng' : detail.paymentMethod === 'PAYOS' ? 'PayOS / VietQR' : detail.paymentMethod || '—'}</b>
              </div>
              <div>
                <span>Trạng thái thanh toán</span>
                <b>{paymentLabels[detail.paymentStatus] || detail.paymentStatus || '—'}</b>
              </div>
              <div className="admin-detail-wide">
                <span><MapPin size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Địa chỉ giao hàng</span>
                <b>{detail.deliveryAddress || '—'}</b>
              </div>
              <div>
                <span><RotateCcw size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Đổi trả</span>
                <b>{returnLabels[detail.returnStatus || 'NONE'] || detail.returnStatus}</b>
                {detail.returnReason && <small>{detail.returnReason}</small>}
              </div>
              {detail.status === 'CANCELLED' && (
                <div className="admin-detail-wide admin-detail-cancel-box">
                  <span><AlertTriangle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />Lý do hủy đơn</span>
                  <b className="admin-cancel-reason">{detail.cancelReason?.trim() || 'Chưa có lý do hủy'}</b>
                  {!detail.cancelReason?.trim() && onCancel && (
                    <button className="admin-action" onClick={() => onCancel(detail)}>Bổ sung lý do</button>
                  )}
                </div>
              )}
            </div>
            {detail.finance&&<React.Suspense fallback={<p role="status">Đang tải sổ hoàn tiền…</p>}><OrderFinancePanel key={detail.id} order={detail} onUpdated={setProcessed} onEditingChange={setFinanceEditing}/></React.Suspense>}
            {showReturn(detail) && <section className="admin-return-management" aria-label="Xử lý đổi trả">
              <h3>Theo dõi đổi trả</h3>
              <p>Yêu cầu lúc: {date(detail.returnRequestedAt)}</p>
              <p>Chỉ ghi nhận xử lý. Không tự hoàn tiền, cộng tồn kho hoặc hoàn lượt voucher.</p>
              <ol className="return-history">
                {(detail.returnHistory || []).map((entry,index)=><li key={entry.id || index}>
                  <b>{returnLabels[entry.status] || entry.status}</b><small>{date(entry.createdAt)}{entry.managerName ? ` · ${entry.managerName}` : ''}</small>
                  <p>{entry.note || 'Không có ghi chú'}</p>
                </li>)}
              </ol>
              {!detail.returnHistory?.length && <p>Chưa có lịch sử xử lý.</p>}
              {!action&&['REQUESTED','APPROVED'].includes(detail.returnStatus)&&detail.status!=='CANCELLED'&&<SourceCareCreator key={detail.id} type="RETURN_ORDER" id={detail.id}/>}
              {!action && <div className="admin-dialog-actions">
                {detail.returnStatus==='REQUESTED' && <><button className="admin-primary" onClick={()=>openAction('APPROVED')}>Chấp thuận</button><button className="admin-action danger-text" onClick={()=>openAction('REJECTED')}>Từ chối</button></>}
                {detail.returnStatus==='APPROVED' && <button className="admin-primary" onClick={()=>openAction('COMPLETED')}>Hoàn tất xử lý</button>}
              </div>}
              {action && <form onSubmit={process} className="admin-return-form">
                <h4>{actionLabels[action]}</h4>
                <label htmlFor="return-processing-note">{action==='REJECTED'?'Lý do từ chối':action==='COMPLETED'?'Ghi chú cách giải quyết (đổi hàng/hoàn tiền đã thực hiện bên ngoài)':'Ghi chú (không bắt buộc)'}</label>
                <textarea id="return-processing-note" autoFocus required={action!=='APPROVED'} maxLength={1000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/>
                <small>{note.length}/1.000 ký tự · Nội dung được thông báo cho khách.</small>
                {failure && <p role="alert" className="danger-text">{failure}</p>}
                <div className="admin-dialog-actions"><button type="button" disabled={busy} onClick={close}>Quay lại</button><button className="admin-primary" disabled={busy || (action!=='APPROVED' && !note.trim())}>{busy?'Đang lưu...':'Xác nhận xử lý'}</button></div>
              </form>}
            </section>}
            <h3>Sản phẩm</h3>
            <div className="admin-detail-items">
              {(detail.items || []).map(item => (
                <div key={item.id} className="admin-detail-item-card">
                  <div className="admin-detail-item-main">
                    <span className="admin-detail-item-name">
                      {item.product?.name || 'Sản phẩm'} × {item.quantity}
                    </span>
                    {(item.size || item.color) && (
                      <small className="admin-detail-item-variant">
                        {[item.size, item.color].filter(Boolean).join(' / ')}
                      </small>
                    )}
                  </div>
                  <b className="admin-detail-item-price">{money(Number(item.unitPrice || 0) * item.quantity)}</b>
                </div>
              ))}
            </div>
            <div className="admin-detail-total">
              <span>Tổng tiền</span>
              <strong>{money(detail.totalAmount)}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
