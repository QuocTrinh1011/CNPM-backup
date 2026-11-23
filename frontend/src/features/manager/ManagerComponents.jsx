import React from "react";
import { CircleAlert, Inbox, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { displayOrderLabel, showReturn } from "../../shared/utils/order-display";
import { statusLabels } from "./manager-data";

const orderTones = {
  PENDING_PAYMENT: "warning",
  PENDING: "warning",
  CONFIRMED: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function OrderBadge({ status, order }) {
  return (
    <>
    <span className="admin-badge" data-tone={showReturn(order) ? "return" : orderTones[status] || "muted"}>
      <span className="admin-badge-dot" />
      {order ? displayOrderLabel(order, statusLabels) : statusLabels[status] || status}
    </span>
    {order?.finance?.reviewRequired&&<small className="payment-review-warning">Thanh toán cần kiểm tra</small>}
    </>
  );
}
export function PanelLoading() {
  return (
    <div className="admin-panel admin-loading-panel" role="status">
      <RefreshCw size={20} className="admin-spinner" aria-hidden="true" />
      <p>Đang tải dữ liệu...</p>
    </div>
  );
}

export function Table({ headers, children, className = '', loading = false, skeletonRows = 5, empty, sticky = false, ariaLabel }) {
  const hasRows = React.Children.count(children) > 0;
  const emptyCopy = typeof empty === 'object' && empty ? empty : { description: empty };
  return (
    <div className={`admin-table-wrap${sticky ? ' is-sticky' : ''} ${className}`}>
      <table aria-label={ariaLabel}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, row) => (
              <tr key={`skeleton-${row}`}>
                {headers.map((__, cell) => (
                  <td key={`skeleton-${row}-${cell}`}>
                    <span className="manager-skeleton__row" />
                  </td>
                ))}
              </tr>
            ))
          ) : hasRows ? (
            React.Children.map(children,row=>React.isValidElement(row)?React.cloneElement(row,{},React.Children.map(row.props.children,(cell,index)=>React.isValidElement(cell)?React.cloneElement(cell,{'data-label':headers[index]}):cell)):row)
          ) : (
            <tr>
              <td className="admin-table-empty" colSpan={headers.length}>
                <span className="admin-state-icon">
                  <Inbox size={20} />
                </span>
                <b>Chưa có dữ liệu</b>
                <small>{emptyCopy?.description || 'Dữ liệu sẽ hiển thị tại đây khi có bản ghi.'}</small>
                {emptyCopy?.action && <span className="manager-empty__action">{emptyCopy.action}</span>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {loading && <span className="manager-sr-only" role="status">Đang tải dữ liệu...</span>}
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
  variant = 'default',
}) {
  if (totalPages <= 1) return null;
  const compact = variant === 'compact';
  return (
    <div className={`admin-pagination${compact ? ' admin-pagination--compact' : ''}`}>
      <span>
        {compact
          ? `Trang ${page + 1}/${totalPages}`
          : `Tổng ${totalElements ?? 0} bản ghi · Trang ${page + 1}/${totalPages}`}
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

export function PanelTitle({ title, subtitle, actions }) {
  return (
    <div className="manager-section-head">
      <div className="manager-section-copy">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="manager-section-actions">{actions}</div>}
    </div>
  );
}

export function FilterChip({ label, onRemove }) {
  return (
    <span className="manager-filter-chip">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Bỏ lọc ${label}`}>
        <X size={12} aria-hidden="true" />
      </button>
    </span>
  );
}

export function ToolbarButton({ active = false, count = 0, children, ...props }) {
  return (
    <button
      type="button"
      className={`manager-filter-toggle${active ? " is-active" : ""}`}
      aria-expanded={active}
      {...props}
    >
      <SlidersHorizontal size={15} aria-hidden="true" />
      {children}
      {count > 0 && <span className="manager-filter-count">{count}</span>}
    </button>
  );
}
