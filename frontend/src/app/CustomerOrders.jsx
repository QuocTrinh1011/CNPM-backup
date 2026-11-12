import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, PackageOpen, Search, Star, X } from "lucide-react";
import { api, endpoints } from "../api/api";
import OrderReviews from "../features/customer/OrderReviews";
import PaymentQr from "../features/storefront/PaymentQr";
import { showReturn, returnLabel, displayOrderLabel, deliveryLabel } from "../shared/utils/order-display";
import { date, imageSrc, protectImage, money } from "../shared/utils/storefront-display";

export const DEFAULT_ORDERS_ROUTE = { orderId: null, tab: "ALL", keyword: "", page: 0 };

const ORDER_TABS = [
  ["ALL", "Tất cả"], ["TO_PAY", "Chờ thanh toán"], ["TO_CONFIRM", "Chờ xác nhận"],
  ["TO_SHIP", "Đang xử lý"], ["TO_RECEIVE", "Đang giao"], ["TO_CONFIRM_RECEIPT", "Chờ nhận hàng"], ["COMPLETED", "Hoàn thành"],
  ["CANCELLED", "Đã hủy"], ["RETURN", "Đổi trả"],
];

export function OrdersPage({ route, onNavigate, onNotice, onChanged }) {
  const [reviewIntent, setReviewIntent] = useState(null);
  const [localRoute, setLocalRoute] = useState(route || DEFAULT_ORDERS_ROUTE);
  const activeRoute = route || localRoute;
  useEffect(() => {
    if (reviewIntent !== null && activeRoute.orderId !== reviewIntent) setReviewIntent(null);
  }, [activeRoute.orderId, reviewIntent]);
  const [searchInput, setSearchInput] = useState(activeRoute.keyword || "");
  const [orders, setOrders] = useState(null);
  const [detail, setDetail] = useState(null);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const move = next => { setReviewIntent(null); return onNavigate ? onNavigate(next) : setLocalRoute(next); };
  const load = useCallback(async (silent = false) => {
    const current = ++generation.current;
    if (!silent) { setError(""); if (activeRoute.orderId) setDetail(null); else { setOrders(null); setTotalElements(0); setTotalPages(0); } }
    try {
      if (activeRoute.orderId) {
        const result = await api(endpoints.order(activeRoute.orderId));
        if (current === generation.current) setDetail(result);
      } else {
        const result = await api(endpoints.orders({ page: activeRoute.page, size: 8, tab: activeRoute.tab, keyword: activeRoute.keyword }));
        if (current === generation.current) {
          setError('');
          setOrders(result.content || []);
          setTotalElements(result.totalElements || 0);
          setTotalPages(result.totalPages || 0);
        }
      }
    } catch (failure) {
      if (current === generation.current) setError(failure.message || "Không tải được đơn hàng.");
    }
  }, [activeRoute.orderId, activeRoute.page, activeRoute.tab, activeRoute.keyword]);
  useEffect(() => {
    void load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate requests from the previous order route before cleanup.
      generation.current++;
    };
  }, [load]);
  useEffect(() => setSearchInput(activeRoute.keyword || ""), [activeRoute.keyword]);
  useEffect(() => {
    if (activeRoute.orderId || !orders?.some(order => order.paymentMethod === "PAYOS" && order.paymentStatus !== "PAID" && order.status !== "CANCELLED")) return;
    const timer = window.setInterval(() => { if (!document.hidden) void load(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [activeRoute.orderId, orders, load]);
  const changeTab = tab => move({ ...activeRoute, orderId: null, tab, page: 0 });
  const submitSearch = event => { event.preventDefault(); move({ ...activeRoute, orderId: null, keyword: searchInput.trim().slice(0, 120), page: 0 }); };
  const openOrder = id => move({ ...activeRoute, orderId: id });
  const backToList = () => move({ ...activeRoute, orderId: null });
  const orderUpdated = async updated => {
    if (updated?.id === activeRoute.orderId) setDetail(updated);
    await load(true);
    onChanged?.();
  };
  const receiptConfirmed = updated => {
    if (updated?.status !== 'COMPLETED') return;
    ++generation.current;
    setError('');
    setDetail(updated);
    if (activeRoute.orderId !== updated.id) move({ ...activeRoute, orderId: updated.id });
    setReviewIntent(updated.id);
    Promise.resolve().then(() => onChanged?.()).catch(() => {});
  };

  return <section className="shop-orders-page" aria-labelledby="shop-orders-title">
    <div className="shop-orders-heading">
      <div><p className="kicker">TÀI KHOẢN / ĐƠN HÀNG</p><h1 id="shop-orders-title">Đơn hàng của tôi</h1><p>Theo dõi thanh toán, giao hàng và các yêu cầu đổi trả.</p></div>
      {activeRoute.orderId && <button type="button" className="button button-light" onClick={backToList}><ArrowLeft size={16}/> Quay lại danh sách</button>}
    </div>

    {!activeRoute.orderId ? <>
      <form className="shop-orders-search" role="search" onSubmit={submitSearch}>
        <Search size={18} aria-hidden="true"/><input type="search" maxLength={120} aria-label="Tìm đơn hàng" placeholder="Tìm theo mã đơn hoặc tên sản phẩm" value={searchInput} onChange={event => setSearchInput(event.target.value)}/>
        {searchInput && <button type="button" aria-label="Xóa nội dung tìm kiếm" onClick={() => { setSearchInput(""); move({ ...activeRoute, keyword: "", page: 0 }); }}><X size={17}/></button>}
        <button className="button button-dark" type="submit"><Search size={16}/> Tìm đơn</button>
      </form>
      <nav className="shop-order-tabs" aria-label="Lọc đơn hàng">
        {ORDER_TABS.map(([key, label]) => <button type="button" key={key} className={activeRoute.tab === key ? "active" : ""} aria-current={activeRoute.tab === key ? "page" : undefined} onClick={() => changeTab(key)}>{label}</button>)}
      </nav>
      <div className="shop-orders-result-count" role="status" aria-live="polite">{orders !== null && !error ? `${totalElements} đơn hàng` : ''}</div>
      {error ? <div className="shop-inline-error" role="alert"><p>{error}</p><button className="button button-light" onClick={() => load()}>Thử lại</button></div> : orders === null ? <div className="shop-orders-loading" role="status">Đang tải đơn hàng...</div> : orders.length ? <div className="shop-order-cards">
        {orders.map(order => <article className="shop-order-card" key={order.id}>
          <header><div><b>Mã đơn #{order.orderCode}</b><time dateTime={order.createdAt}>{date(order.createdAt)}</time></div><div className="shop-order-badges"><Status value={order.status} order={order}/>{order.paymentMethod === "PAYOS" ? <span className={order.paymentStatus === "PAID" ? "shop-payment-label is-paid" : "shop-payment-label"}>{order.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}</span> : <span className="shop-payment-label">Thanh toán khi nhận hàng</span>}</div></header>
          <div className="shop-order-products">{(order.items || []).slice(0, 3).map((item, index) => <div className="shop-order-product" key={`${item.productId}-${item.size || ""}-${item.color || ""}-${index}`}><img src={imageSrc(item.imageUrl)} onError={protectImage} alt=""/><div><b>{item.name}</b><small>{[item.size, item.color].filter(Boolean).join(" · ") || "Phân loại tiêu chuẩn"} · SL: {item.quantity}</small></div><strong>{money(item.lineTotal)}</strong></div>)}{(order.items?.length || 0) > 3 && <p className="shop-order-more">Còn {order.items.length - 3} sản phẩm khác</p>}</div>
          <footer><span>{order.items?.length || 0} sản phẩm</span><div><span>Thành tiền</span><strong>{money(order.totalAmount)}</strong><ReceiptAction order={order} onChanged={receiptConfirmed} onNotice={onNotice}/>{order.status === 'COMPLETED' && <button type="button" className="button button-light review-card-btn" onClick={() => openOrder(order.id)}><Star size={14}/> Đánh giá</button>}<button type="button" className="button button-dark" onClick={() => openOrder(order.id)}>Chi tiết đơn <ChevronRight size={16}/></button></div></footer>
        </article>)}
      </div> : <div className="shop-orders-empty"><PackageOpen size={38}/><h2>{activeRoute.keyword ? "Không tìm thấy đơn phù hợp" : activeRoute.tab === "ALL" ? "Bạn chưa có đơn hàng" : "Chưa có đơn trong mục này"}</h2><p>{activeRoute.keyword ? "Thử mã đơn hoặc tên sản phẩm khác." : "Đơn hàng của bạn sẽ xuất hiện tại đây sau khi đặt hàng."}</p>{(activeRoute.keyword || activeRoute.tab !== "ALL") && <button className="button button-light" onClick={() => move({ ...DEFAULT_ORDERS_ROUTE })}>Xem tất cả đơn hàng</button>}</div>}
      {!error && totalPages > 1 && <nav className="shop-orders-pagination" aria-label="Phân trang đơn hàng"><button type="button" className="button button-light" disabled={activeRoute.page === 0 || orders === null} onClick={() => move({ ...activeRoute, page: activeRoute.page - 1 })}>Trang trước</button><span>Trang {activeRoute.page + 1} / {totalPages}</span><button type="button" className="button button-light" disabled={activeRoute.page + 1 >= totalPages || orders === null} onClick={() => move({ ...activeRoute, page: activeRoute.page + 1 })}>Trang sau</button></nav>}
    </> : error ? <div className="shop-inline-error" role="alert"><p>{error}</p><button className="button button-light" onClick={() => load()}>Thử lại</button></div> : detail ? <div className="shop-order-detail-page"><OrderView order={detail} onNotice={onNotice} onPaymentChanged={() => load(true)} onChanged={orderUpdated} onReceiptConfirmed={receiptConfirmed} autoReview={reviewIntent === detail.id} onReviewOpened={() => setReviewIntent(null)}/></div> : <div className="shop-orders-loading" role="status">Đang tải chi tiết đơn hàng...</div>}
  </section>;
}

// Kept as an export for existing callers/tests; the order history itself is no longer a dialog.
export function OrdersModal({ onNotice, onChanged }) {
  return <OrdersPage onNotice={onNotice} onChanged={onChanged}/>;
}
export function ReceiptAction({ order, onChanged, onNotice }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const confirm = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const updated = await api(`/api/orders/${order.id}/confirm-receipt`, { method: 'PATCH' });
      if (updated?.status !== 'COMPLETED') throw new Error('Đơn chưa được xác nhận hoàn thành. Vui lòng thử lại.');
      setOpen(false); onNotice?.('Đã xác nhận nhận hàng thành công. Bạn có thể đánh giá sản phẩm ngay.'); await onChanged?.(updated);
    } catch (failure) { setError(failure.message || 'Không xác nhận được. Vui lòng thử lại.'); }
    finally { lock.current = false; setBusy(false); }
  };
  if (order.status !== 'DELIVERED' || (order.returnStatus || 'NONE') !== 'NONE') return null;
  return <><button type="button" className="button button-light" disabled={busy} onClick={() => { setError(''); setOpen(true); }}>Đã nhận hàng</button>
    {open && <div className="modal-backdrop"><section className="wide-modal shop-receipt-dialog" role="dialog" aria-modal="true" aria-label="Xác nhận đã nhận hàng">
      <button type="button" className="close-button" aria-label="Đóng xác nhận nhận hàng" disabled={busy} onClick={() => setOpen(false)}><X size={20}/></button>
      <h2>Xác nhận đã nhận hàng</h2><p>Bạn đã nhận đủ sản phẩm của đơn #{order.orderCode}? Đơn sẽ chuyển sang Hoàn thành.</p>
      {error && <p role="alert" className="shop-inline-error">{error}</p>}
      <div className="order-actions"><button type="button" className="button button-light" disabled={busy} onClick={() => setOpen(false)}>Quay lại</button><button type="button" className="button button-dark" disabled={busy} onClick={confirm}>{busy ? 'Đang xác nhận...' : 'Xác nhận đã nhận'}</button></div>
    </section></div>}
  </>;
}
export function OrderView({ order, onNotice, onChanged, onPaymentChanged, onReceiptConfirmed, autoReview, onReviewOpened }) {
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(order.paymentStatus === "PAID");
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const actionLock = useRef(false);
  const [hasOrderReview, setHasOrderReview] = useState(null);
  useEffect(() => setHasOrderReview(null), [order.id]);
  useEffect(() => setPaid(order.paymentStatus === "PAID"), [order.id, order.paymentStatus]);
  const cancellableStatuses = ["PENDING_PAYMENT", "PENDING", "CONFIRMED", "PREPARING"];
  const cancel = () => { setAction('cancel'); setReason(''); setActionError(''); };
  const requestReturn = () => { setAction('return'); setReason(''); setActionError(''); };
  const submitAction = async event => {
    event.preventDefault();
    if (actionLock.current) return;
    if (!reason.trim()) { setActionError('Vui lòng nhập lý do.'); return; }
    actionLock.current = true; setBusy(true); setActionError('');
    try {
      const updated = await api(action === 'cancel' ? endpoints.cancelOrder(order.id) : endpoints.returnOrder(order.id), { method: action === 'cancel' ? 'PATCH' : 'POST', body: { reason: reason.trim() } });
      if (action === 'cancel' && updated.status !== 'CANCELLED') { setPaid(updated.paymentStatus === 'PAID'); setActionError('Đơn đã được thanh toán nên chưa thể hủy. Vui lòng tải lại trạng thái đơn.'); onPaymentChanged?.(); return; }
      setAction(null); onNotice?.(action === 'cancel' ? 'Đã hủy đơn hàng.' : 'Đã gửi yêu cầu đổi/trả.'); await onChanged?.(updated);
    } catch (error) { setActionError(error.message); }
    finally { actionLock.current = false; setBusy(false); }
  };
  return (
    <div className="order-view">
      {order.status === 'COMPLETED' && <OrderReviews key={order.id} order={order} autoOpen={autoReview} onAutoOpened={onReviewOpened} onReviewStatus={setHasOrderReview}/>}
      {action && <form className="shop-reason-form" onSubmit={submitAction}><h3>{action === 'cancel' ? 'Hủy đơn hàng' : 'Yêu cầu đổi/trả'}</h3><label>Lý do<textarea autoFocus required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>{actionError && <p role="alert" className="shop-inline-error">{actionError}</p>}<div className="order-actions"><button type="button" className="button button-light" disabled={busy} onClick={() => setAction(null)}>Quay lại</button><button className="button button-dark" disabled={busy}>{busy ? 'Đang gửi...' : 'Xác nhận'}</button></div></form>}
      <div className="order-view-head">
        <div>
          <p className="kicker">MÃ ĐƠN #{order.orderCode}</p>
          <h3>{date(order.createdAt)}</h3>
        </div>
        <Status value={order.status} order={order} />
      </div>
      {showReturn(order) && <p className="order-address"><b>Trạng thái giao hàng:</b> {deliveryLabel(order, { DELIVERED: 'Đã giao', COMPLETED: 'Đã nhận hàng' })}</p>}
      <div className="order-progress">
        <span className="done">ĐẶT HÀNG</span>
        <i
          className={
            ["CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED"].includes(
              order.status,
            )
              ? "done"
              : ""
          }
        />
        <span
          className={
            ["SHIPPED", "DELIVERING", "DELIVERED", "COMPLETED"].includes(order.status)
              ? "done"
              : ""
          }
        >
          ĐANG GIAO
        </span>
        <i
          className={
            order.status === "COMPLETED" ? "done" : ""
          }
        />
        <span
          className={
            order.status === "COMPLETED" ? "done" : ""
          }
        >
          ĐÃ NHẬN
        </span>
      </div>
      {order.items?.map((item) => (
        <div className="order-item" key={`${item.productId}-${item.size || ""}-${item.color || ""}`}>
          <img
            src={imageSrc(item.imageUrl)}
            onError={protectImage}
            alt={item.name}
          />
          <div>
            <b>{item.name}</b>
            <small>Số lượng: {item.quantity} · {item.size || "Không chọn size"} · {item.color || "Không chọn màu"}</small>
          </div>
          <strong>{money(item.lineTotal)}</strong>
        </div>
      ))}
      {order.discountAmount > 0 && <div className="order-total"><span>GIẢM GIÁ {order.voucherCode ? `(${order.voucherCode})` : ""}</span><strong>-{money(order.discountAmount)}</strong></div>}
      <div className="order-total"><span>TỔNG ĐƠN HÀNG</span><strong>{money(order.totalAmount)}</strong></div>
      <p className="shop-order-payment-method"><b>Phương thức thanh toán:</b> {order.paymentMethod === "PAYOS" ? "Quét mã QR PayOS" : "Thanh toán khi nhận hàng"}</p>
      {order.paymentMethod === "PAYOS" && <p className={paid ? "shop-payment-label is-paid" : "shop-payment-label"}>Trạng thái thanh toán: {paid ? "Đã thanh toán" : "Chưa thanh toán"}</p>}
      {order.paymentMethod === "PAYOS" && <PaymentQr orderId={order.id} onPaid={order.paymentStatus === "PAID" ? undefined : () => { setPaid(true); onNotice?.("Thanh toán thành công!"); onPaymentChanged?.(); }} />}
      {order.trackingCode && <p className="order-address"><b>Mã theo dõi</b><br />{order.trackingCode}</p>}
      {order.status === "CANCELLED" && <p className="order-address order-cancel-reason"><b>Lý do hủy đơn</b><br />{order.cancelReason?.trim() || "Chưa có lý do hủy"}</p>}
      {(order.returnStatus || "NONE") !== "NONE" && <p className="order-address"><b>Đổi/trả hàng: {returnLabel(order.returnStatus)}</b><br />{order.returnReason}</p>}
      {!!order.returnHistory?.length && <section className="order-address" aria-label="Lịch sử đổi trả"><b>Lịch sử xử lý đổi trả</b><ol className="return-history">{order.returnHistory.map((entry,index)=><li key={index}><b>{returnLabel(entry.status)}</b><small>{date(entry.createdAt)}</small><p>{entry.note || 'Không có ghi chú'}</p></li>)}</ol></section>}
      <p className="order-address">
        <b>Địa chỉ giao hàng</b>
        <br />
        {order.deliveryAddress}
      </p>
      {order.status === 'COMPLETED' && hasOrderReview === true && <p className="order-address">Đơn đã xác nhận nhận hàng và đã đánh giá sản phẩm nên không thể yêu cầu đổi trả.</p>}
      <div className="order-actions">{!busy && !action && <ReceiptAction order={order} onChanged={onReceiptConfirmed || onChanged} onNotice={onNotice}/>} {cancellableStatuses.includes(order.status) && <button type="button" className="button button-light" disabled={busy} onClick={cancel}>{busy ? "ĐANG HỦY..." : "HỦY ĐƠN"}</button>}{(order.status === 'DELIVERED' || (order.status === 'COMPLETED' && hasOrderReview === false)) && (order.returnStatus || "NONE") === "NONE" && <button type="button" className="button button-light" disabled={busy} onClick={requestReturn}>YÊU CẦU ĐỔI/TRẢ</button>}</div>
    </div>
  );
}

function Status({ value, order }) {
  const labels = {
    PENDING_PAYMENT: "Chờ thanh toán",
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    PREPARING: "Đang chuẩn bị",
    SHIPPED: "Đang giao",
    DELIVERING: "Đang giao",
    DELIVERED: "Đã giao — chờ bạn xác nhận",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã huỷ",
  };
  return (
    <span className={`status-pill ${showReturn(order) ? "return-requested" : String(value).toLowerCase()}`}>
      {order ? displayOrderLabel(order, labels) : labels[value] || value}
    </span>
  );
}
