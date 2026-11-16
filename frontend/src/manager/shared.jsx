import React from "react";
import { Inbox, CircleAlert, RefreshCw } from "lucide-react";
import { useManagerList } from "../useManagerResource";
import { canAdvanceOrder } from "../order-transitions";
import { showReturn, displayOrderLabel } from "../order-display";

export const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
export const pageData = (value) => value?.content || [];
export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const statusLabels = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao — chờ khách xác nhận",
  COMPLETED: "Khách đã nhận hàng",
  CANCELLED: "Đã hủy",
};
export const statusColors = {
  PENDING_PAYMENT: "#f59e0b",
  PENDING: "#d97706",
  CONFIRMED: "#8b5cf6",
  SHIPPED: "#3b82f6",
  DELIVERED: "#10b981",
  COMPLETED: "#14b8a6",
  CANCELLED: "#ef4444",
};
export const orderStatuses = Object.entries(statusLabels);
export const orderStatusOptions = (current,order) => [
  [
    current,
    statusLabels[current] ||
      ({
        PENDING: "Chờ xác nhận",
        PREPARING: "Đang chuẩn bị",
        DELIVERING: "Đang giao",
      })[current] ||
      current,
  ],
  ...orderStatuses.filter(
    ([value]) => value !== current && canAdvanceOrder(current, value) && !(value==='CANCELLED'&&order?.finance?.reviewRequired)
  ),
];
export const paymentMethodLabels = {
  COD: "Thanh toán khi nhận hàng",
  PAYOS: "Thanh toán trực tuyến",
};
export const paymentStatusLabels = {
  COD: "Thanh toán khi nhận hàng",
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};

export function PanelLoading() {
  return (
    <div className="admin-panel admin-loading-panel" role="status">
      <RefreshCw size={20} className="admin-spinner" aria-hidden="true" />
      <p>Đang tải dữ liệu...</p>
    </div>
  );
}
export const useAdminList = useManagerList;

export function OrderBadge({ status, order }) {
  return (
    <>
      <span className="admin-badge" style={{ color: showReturn(order) ? "var(--order-return-color, #c2410c)" : statusColors[status] }}>
        <span className="admin-badge-dot" />
        {order ? displayOrderLabel(order, statusLabels) : statusLabels[status] || status}
      </span>
      {order?.finance?.reviewRequired && <small className="refund-warning">Thanh toán cần kiểm tra</small>}
      {Number(order?.finance?.refund?.pendingAmount) > 0 && <small>Còn khoản chờ hoàn tiền</small>}
    </>
  );
}


export function Table({ headers, children, className = '' }) {
  const hasRows = React.Children.count(children) > 0;
  return (
    <div className={`admin-table-wrap ${className}`}>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            React.Children.map(children,row=>React.isValidElement(row)?React.cloneElement(row,{},React.Children.map(row.props.children,(cell,index)=>React.isValidElement(cell)?React.cloneElement(cell,{'data-label':headers[index]}):cell)):row)
          ) : (
            <tr>
              <td className="admin-table-empty" colSpan={headers.length}>
                <span className="admin-state-icon">
                  <Inbox size={20} />
                </span>
                <b>Chưa có dữ liệu</b>
                <small>Dữ liệu sẽ hiển thị tại đây khi có bản ghi.</small>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function ListError({ message, onRetry }) {
  return (
    <div className="admin-list-error">
      <span className="admin-state-icon">
        <CircleAlert size={20} />
      </span>
      <div>
        <b>Không tải được dữ liệu</b>
        <p>{message}</p>
      </div>
      <button className="admin-action" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}


export function PageControls({
  page,
  totalPages,
  totalElements,
  onPage,
  disabled = false,
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <span>
        Tổng {totalElements ?? 0} bản ghi · Trang {page + 1}/{totalPages}
      </span>
      <div>
        <button
          disabled={disabled || page <= 0}
          onClick={() => onPage(page - 1)}
        >
          Trước
        </button>
        <button
          disabled={disabled || page + 1 >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Sau
        </button>
      </div>
    </div>
  );
}


export function PanelTitle({ title, subtitle }) {
  return (
    <div className="admin-panel-title">
      <div>
        <span className="admin-eyebrow">QUẢN LÝ CỬA HÀNG</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
