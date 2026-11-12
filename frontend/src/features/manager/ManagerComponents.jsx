import React from "react";
import { CircleAlert, Inbox, RefreshCw } from "lucide-react";
import { displayOrderLabel, showReturn } from "../../shared/utils/order-display";
import { statusColors, statusLabels } from "./manager-data";

export function OrderBadge({ status, order }) {
  return (
    <>
    <span className="admin-badge" style={{ color: showReturn(order) ? "var(--order-return-color, #c2410c)" : statusColors[status] }}>
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
