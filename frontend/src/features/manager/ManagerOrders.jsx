import React, { useCallback, useMemo, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { hasReturn, showReturn, returnLabel } from "../../shared/utils/order-display";
import { useManagerFilters, managerQuery, vietnamDateRange } from "../../shared/hooks/useManagerFilters";
import ManagerOrderDetail from "./ManagerOrderDetail";
import { useManagerList, useManagerList as useAdminList } from "../../shared/hooks/useManagerResource";
import { isFinalOrder } from "./order-transitions";
import { money, pageData, orderStatuses, orderStatusOptions, paymentMethodLabels, paymentStatusLabels, formatDate } from "./manager-data";
import { OrderBadge, PanelLoading, Table, ListError, PageControls, PanelTitle } from "./ManagerComponents";
import { adminApi, adminEndpoints } from "../../api/manager-api";

export default function Orders({ notify }) {
  const [filters,changeFilters]=useManagerFilters({status:'',q:'',paymentStatus:'',paymentReview:'',fromDate:'',toDate:'',sort:'createdAt',direction:'DESC',page:'0'});
  const page=Number(filters.page)||0,setPage=value=>changeFilters({page:String(value)});
  const status=filters.status,setStatus=value=>changeFilters({status:value});
  const search=filters.q,setSearch=value=>changeFilters({q:value});
  const query=useMemo(()=>({status:filters.status,q:filters.q,paymentStatus:filters.paymentStatus,paymentReview:filters.paymentReview,sort:filters.sort,direction:filters.direction,page,...vietnamDateRange(filters.fromDate,filters.toDate)}),[filters,page]);
  const summaryEndpoint=useCallback(()=>'/api/manager/orders/summary?'+managerQuery({q:query.q,paymentStatus:query.paymentStatus,paymentReview:query.paymentReview,from:query.from,to:query.to}),[query.q,query.paymentStatus,query.paymentReview,query.from,query.to]);
  const {data:counts}=useManagerList(summaryEndpoint);
  const [detailId, setDetailId] = useState(null);
  const detailEndpoint = useCallback(() => adminEndpoints.order(detailId), [detailId]);
  const { data: detailData, loading: detailLoading, error: detailError, load: reloadDetail } =
    useManagerList(detailEndpoint, { enabled: detailId !== null });
  const detail = detailId === null ? null : (detailData?.id === detailId ? detailData : { id: detailId });
  const [updatingId, setUpdatingId] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const openCancel = (order) => {
    setCancelOrder(order);
    setCancelReason("");
    setCancelError("");
  };
  const closeCancel = () => {
    if (updatingId === null) setCancelOrder(null);
  };
  const changeStatus = (order, nextStatus) =>
    nextStatus === "CANCELLED"
      ? openCancel(order)
      : update(order.id, nextStatus);
  const endpoint = useCallback(
    () => adminEndpoints.orders(query),
    [query]
  );
  const { data:previousData, load, loading, error,stale } = useAdminList(endpoint,{keepPreviousData:true});
  const data=stale?null:previousData;
  const update = async (id, status, reason) => {
    if (updatingId !== null) return;
    setUpdatingId(id);
    setCancelError("");
    try {
      await adminApi(adminEndpoints.orderStatus(id), {
        method: "PATCH",
        body: {
          status,
          ...(reason !== undefined ? { reason: reason.trim() } : {}),
        },
      });
      notify("Đã cập nhật đơn hàng.");
      if (detailId === id) await reloadDetail(true);
      setCancelOrder(null);
      await load();
    } catch (error) {
      if (status === "CANCELLED") setCancelError(error.message);
      notify(error.message, "error");
    } finally {
      setUpdatingId(null);
    }
  };
  const showDetail = (id) => {
    if (detailId === id) void reloadDetail();
    else setDetailId(id);
  };
  const orders = pageData(data);
  const filteredOrders = orders;

  const orderQuickTabs = [
    { key: "", label: "Tất cả", color: "#64748b" },
    { key: "PENDING", label: "Chờ xác nhận", color: "#d97706" },
    { key: "CONFIRMED", label: "Đã xác nhận", color: "#8b5cf6" },
    { key: "SHIPPED", label: "Đang giao", color: "#3b82f6" },
    { key: "DELIVERED", label: "Đã giao", color: "#10b981" },
    { key: "COMPLETED", label: "Khách đã nhận", color: "#14b8a6" },
    { key: "CANCELLED", label: "Đã hủy", color: "#ef4444" },
    { key: "RETURN", label: "Đổi trả", color: "#c2410c" },
  ];

  if (loading && !previousData) return <PanelLoading />;
  if (error)
    return (
      <div className="admin-panel">
        <ListError message={error} onRetry={load} />
      </div>
    );
  return (
    <div className="admin-panel">
      <PanelTitle
        title="Đơn hàng"
        subtitle="Theo dõi và cập nhật tiến trình giao hàng."
      />
      <div className="admin-order-status-tabs" role="tablist" aria-label="Lọc nhanh trạng thái đơn">
        {orderQuickTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`admin-status-tab-btn ${status === tab.key ? "active" : ""}`}
            onClick={() => {
              setStatus(tab.key);
              setPage(0);
            }}
          >
            <span className="admin-status-tab-dot" style={{ background: tab.color }} />
            <span>{tab.label}{counts?.[tab.key||'ALL']!==undefined?` (${counts[tab.key||'ALL']})`:''}</span>
          </button>
        ))}
      </div>
      <div className="admin-order-toolbar">
        <div className="admin-search-wrap">
          <Search size={15} className="admin-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="admin-search-input"
            placeholder="Tìm theo mã đơn, khách hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => setSearch("")}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="admin-order-filter-select">
          <label htmlFor="admin-order-status">Lọc trạng thái</label>
          <select
            id="admin-order-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả đơn hàng</option>
            <option value="RETURN">Tất cả đổi trả</option>
            <option value="RETURN_REQUESTED">Đổi trả — chờ xử lý</option>
            <option value="RETURN_APPROVED">Đổi trả — đã chấp thuận</option>
            <option value="RETURN_REJECTED">Đổi trả — đã từ chối</option>
            <option value="RETURN_COMPLETED">Đổi trả — hoàn tất</option>
            {orderStatuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <span>{data?.totalElements ?? 0} đơn hàng</span>
        <button type="button" className="admin-action" onClick={load} aria-label="Tải lại trạng thái thanh toán"><RefreshCw size={16} /> Tải lại</button>
      </div>
      <div className="manager-advanced-filters">
        <label>Thanh toán<select value={filters.paymentStatus} onChange={e=>changeFilters({paymentStatus:e.target.value})}><option value="">Tất cả</option><option value="COD">COD</option><option value="PENDING">Chờ thanh toán</option><option value="PAID">Đã thanh toán</option><option value="EXPIRED">Hết hạn</option><option value="FAILED">Thất bại</option><option value="CANCELLED">Đã hủy thanh toán</option></select></label>
        <label>Đối soát PayOS<select value={filters.paymentReview} onChange={e=>changeFilters({paymentReview:e.target.value})}><option value="">Tất cả</option><option value="true">Thanh toán cần kiểm tra</option><option value="false">Không có cảnh báo</option></select></label>
        <label>Từ ngày<input type="date" value={filters.fromDate} onChange={e=>changeFilters({fromDate:e.target.value})}/></label>
        <label>Đến ngày<input type="date" value={filters.toDate} onChange={e=>changeFilters({toDate:e.target.value})}/></label>
        <label>Sắp xếp<select value={filters.sort} onChange={e=>changeFilters({sort:e.target.value})}><option value="createdAt">Ngày đặt</option><option value="totalAmount">Tổng tiền</option><option value="orderCode">Mã đơn</option></select></label>
        <label>Thứ tự<select value={filters.direction} onChange={e=>changeFilters({direction:e.target.value})}><option value="DESC">Giảm dần</option><option value="ASC">Tăng dần</option></select></label>
      </div>
      <div className="admin-order-table">
        <Table
          headers={[
            "Mã đơn / Ngày",
            "Khách hàng",
            "Thanh toán",
            "Tổng tiền",
            "Trạng thái",
            "Thao tác",
          ]}
        >
          {filteredOrders.map((order) => (
            <tr key={order.id}>
              <td>
                <span className="admin-order-code-badge">#{order.orderCode}</span>
                <small className="admin-table-subline">
                  {formatDate(order.createdAt)}
                </small>
              </td>
              <td>
                <div className="admin-table-customer">
                  <span className="admin-customer-avatar">
                    {(order.customer?.fullName || "C").trim().slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <b>{order.customer?.fullName || "Customer"}</b>
                    <small className="admin-table-subline">
                      {order.customer?.email || ""}
                    </small>
                  </div>
                </div>
              </td>
              <td>
                <span className="admin-payment-method">
                  {paymentMethodLabels[order.paymentMethod] ||
                    order.paymentMethod ||
                    "—"}
                </span>
                {order.paymentMethod === "PAYOS" && (
                  <small
                    className={`admin-table-subline admin-payment-status-pill ${
                      order.paymentStatus === "PAID"
                        ? "is-paid"
                        : order.paymentStatus === "PENDING"
                        ? "is-pending"
                        : ""
                    }`}
                    aria-label="Trạng thái thanh toán"
                  >
                    {paymentStatusLabels[order.paymentStatus] ||
                      order.paymentStatus ||
                      "—"}
                  </small>
                )}
              </td>
              <td className="admin-order-total-cell">
                <strong>{money(order.totalAmount)}</strong>
              </td>
              <td>
                <OrderBadge status={order.status} order={order} />
              </td>
              <td>
                <div className="admin-order-actions">
                  <select
                    className="admin-inline-status-select"
                    aria-label={`Cập nhật trạng thái đơn ${order.orderCode}`}
                    disabled={
                      updatingId !== null || isFinalOrder(order.status) || hasReturn(order)
                    }
                    value={order.status}
                    onChange={(event) =>
                      changeStatus(order, event.target.value)
                    }
                  >
                    {(showReturn(order) ? [[order.status, ['REJECTED','COMPLETED'].includes(order.returnStatus) ? returnLabel(order.returnStatus) : "Đang đổi trả"]] : orderStatusOptions(order.status,order)).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="admin-action"
                    onClick={() => showDetail(order.id)}
                  >
                    Chi tiết
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <div className="admin-order-cards">
        {filteredOrders.length ? (
          filteredOrders.map((order) => (
            <article className="admin-order-card" key={order.id}>
              <div>
                <b>#{order.orderCode}</b>
                <OrderBadge status={order.status} order={order} />
              </div>
              <small>{formatDate(order.createdAt)}</small>
              <p>{order.customer?.fullName || "Customer"}</p>
              <p>
                {paymentMethodLabels[order.paymentMethod] ||
                  order.paymentMethod ||
                  "—"}
              </p>
              {order.paymentMethod === "PAYOS" && <p aria-label="Trạng thái thanh toán">{paymentStatusLabels[order.paymentStatus] || order.paymentStatus || "—"}</p>}
              <strong>{money(order.totalAmount)}</strong>
              <div className="admin-order-actions">
                <select
                  aria-label={`Cập nhật trạng thái đơn ${order.orderCode}`}
                  disabled={
                    updatingId !== null || isFinalOrder(order.status) || hasReturn(order)
                  }
                  value={order.status}
                  onChange={(event) => changeStatus(order, event.target.value)}
                >
                  {(showReturn(order) ? [[order.status, ['REJECTED','COMPLETED'].includes(order.returnStatus) ? returnLabel(order.returnStatus) : "Đang đổi trả"]] : orderStatusOptions(order.status,order)).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  className="admin-action"
                  onClick={() => showDetail(order.id)}
                >
                  Xem chi tiết
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="admin-order-empty">
            Không có đơn hàng trong trạng thái này.
          </div>
        )}
      </div>
      <PageControls
        page={page}
        totalPages={data?.totalPages || 0}
        totalElements={data?.totalElements}
        onPage={setPage}
      />
      {cancelOrder && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCancel();
          }}
        >
          <form
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-cancel-title"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                cancelReason.trim() &&
                cancelReason.trim().length <= 1000
              )
                update(cancelOrder.id, "CANCELLED", cancelReason);
            }}
          >
            <h2 id="admin-cancel-title">
              {cancelOrder.status === "CANCELLED"
                ? "Bổ sung lý do hủy đơn"
                : "Hủy đơn hàng"}{" "}
              #{cancelOrder.orderCode}
            </h2>
            <p>Lý do này sẽ được gửi đến người mua trong mục Thông báo.</p>
            <label htmlFor="admin-cancel-reason">Lý do hủy đơn</label>
            <textarea
              id="admin-cancel-reason"
              required
              maxLength={1000}
              value={cancelReason}
              disabled={updatingId !== null}
              onChange={(event) => setCancelReason(event.target.value)}
            />
            <small>{cancelReason.length}/1000 ký tự</small>
            {cancelError && (
              <p role="alert" className="danger-text">
                {cancelError}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                onClick={closeCancel}
                disabled={updatingId !== null}
              >
                Quay lại
              </button>
              <button
                className="admin-primary admin-danger-button"
                disabled={updatingId !== null || !cancelReason.trim()}
              >
                {updatingId !== null
                  ? "Đang lưu..."
                  : cancelOrder.status === "CANCELLED"
                  ? "Lưu lý do"
                  : "Xác nhận hủy"}
              </button>
            </div>
          </form>
        </div>
      )}
      {detail && !cancelOrder && <ManagerOrderDetail detail={detail} loading={detailLoading} error={detailError} onRetry={() => showDetail(detail.id)} onClose={() => setDetailId(null)} onCancel={openCancel} />}
    </div>
  );
}
