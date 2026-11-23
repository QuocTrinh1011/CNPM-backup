import { showReturn } from "../../../shared/utils/order-display";
import { TicketPercent } from "lucide-react";
import { money, pageData, statusLabels } from "../manager-data";
import { OrderBadge, PanelLoading, Table, ListError } from "../ManagerComponents";
import React from "react";
import { Users as UsersIcon, Package, ShoppingCart, MessageSquare, ClipboardList, ArrowRight, ChevronRight } from "lucide-react";
import { adminEndpoints } from "../../../api/manager-api";
import { useManagerList as useAdminList } from "../../../shared/hooks/useManagerResource";

const recentOrdersEndpoint = () => adminEndpoints.orders({ size: 100 });

const orderSummaryEndpoint = () => '/api/manager/orders/summary';

const statusTones = {
  PENDING: "warning",
  PENDING_PAYMENT: "warning",
  CONFIRMED: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  COMPLETED: "success",
  RETURN: "danger",
  CANCELLED: "danger",
};

export function Dashboard({ go }) {
  return (
    <div className="admin-content">
      {/* Quick Action Navigation Grid */}
      <section className="admin-panel admin-quick-actions-panel">
        <div className="admin-section-heading">
          <div>
            <h2>Lối tắt quản lý</h2>
            <p>Truy cập nhanh các phân hệ nghiệp vụ chính của cửa hàng</p>
          </div>
        </div>
        <div className="admin-quick-grid">
          <button type="button" className="admin-quick-card" onClick={() => go("orders")} title="Đến trang xử lý đơn hàng">
            <span className="admin-quick-icon">
              <ShoppingCart size={18} aria-hidden="true" />
            </span>
            <span className="admin-quick-text">
              <b>Xử lý đơn hàng</b>
              <small>Theo dõi giao hàng &amp; trạng thái</small>
            </span>
            <ChevronRight size={16} className="admin-quick-arrow" aria-hidden="true" />
          </button>
          <button type="button" className="admin-quick-card" onClick={() => go("products")} title="Đến trang quản lý sản phẩm">
            <span className="admin-quick-icon">
              <Package size={18} aria-hidden="true" />
            </span>
            <span className="admin-quick-text">
              <b>Kho sản phẩm</b>
              <small>Quản lý giá bán &amp; tồn kho</small>
            </span>
            <ChevronRight size={16} className="admin-quick-arrow" aria-hidden="true" />
          </button>
          <button type="button" className="admin-quick-card" onClick={() => go("vouchers")} title="Đến trang Voucher">
            <span className="admin-quick-icon">
              <TicketPercent size={18} aria-hidden="true" />
            </span>
            <span className="admin-quick-text">
              <b>Voucher cửa hàng</b>
              <small>Quản lý mã và lượt sử dụng</small>
            </span>
            <ChevronRight size={16} className="admin-quick-arrow" aria-hidden="true" />
          </button>
          <button type="button" className="admin-quick-card" onClick={() => go("users")} title="Đến danh sách khách hàng">
            <span className="admin-quick-icon">
              <UsersIcon size={18} aria-hidden="true" />
            </span>
            <span className="admin-quick-text">
              <b>Hồ sơ khách hàng</b>
              <small>Tra cứu danh sách &amp; phân quyền</small>
            </span>
            <ChevronRight size={16} className="admin-quick-arrow" aria-hidden="true" />
          </button>
          <button type="button" className="admin-quick-card" onClick={() => go("surveys")} title="Đến trang khảo sát ý kiến">
            <span className="admin-quick-icon">
              <ClipboardList size={18} aria-hidden="true" />
            </span>
            <span className="admin-quick-text">
              <b>Khảo sát ý kiến</b>
              <small>Tạo câu hỏi &amp; xem phản hồi</small>
            </span>
            <ChevronRight size={16} className="admin-quick-arrow" aria-hidden="true" />
          </button>
          <button type="button" className="admin-quick-card" onClick={() => go("feedback")} title="Đến trang phản hồi đánh giá">
            <span className="admin-quick-icon">
              <MessageSquare size={18} aria-hidden="true" />
            </span>
            <span className="admin-quick-text">
              <b>Phản hồi đánh giá</b>
              <small>Duyệt &amp; trả lời khách hàng</small>
            </span>
            <ChevronRight size={16} className="admin-quick-arrow" aria-hidden="true" />
          </button>
        </div>
      </section>

      <RecentOrders go={go} />
    </div>
  );
}

export function RecentOrders({ go }) {
  const { data, loading, error, load } = useAdminList(recentOrdersEndpoint);
  const {data:summary} = useAdminList(orderSummaryEndpoint);
  if (loading) return <PanelLoading />;
  if (error)
    return (
      <div className="admin-panel">
        <ListError message={error} onRetry={load} />
      </div>
    );
  const orders = pageData(data);
  const counts = Object.entries({...statusLabels,RETURN:'Đổi trả'}).filter(([status])=>status!=='PENDING_PAYMENT').map(([status, label]) => ({
    status,
    label,
    count: Number.isFinite(summary?.ALL) ? (summary[status]||0) : orders.filter((order) => status==='RETURN'?showReturn(order):!showReturn(order)&&order.status === status).length,
  }));
  return (
    <section className="admin-panel admin-recent-orders">
      <div className="admin-section-heading">
        <div>
          <h2>Đơn hàng gần đây</h2>
          <p>{Number.isFinite(summary?.ALL)?`Trạng thái toàn bộ ${summary.ALL} đơn hàng`:`Phân bố trạng thái trong ${orders.length} đơn mới nhất`}</p>
        </div>
        <button className="admin-action" onClick={() => go("orders")}>
          Xem tất cả <ArrowRight size={14} />
        </button>
      </div>
      <div className="admin-status-strip">
        {counts.map(({ status, label, count }) => (
          <button type="button"
            key={status}
            className="admin-status-chip"
            onClick={() => go(`orders?status=${encodeURIComponent(status)}`)}
            title={`Lọc đơn hàng: ${label}`}
          >
            <i className="admin-status-dot" data-tone={statusTones[status] || "muted"} aria-hidden="true" />
            {label}
            <b>{count}</b>
          </button>
        ))}
      </div>
      <Table headers={["Mã đơn", "Khách hàng", "Tổng tiền", "Trạng thái"]}>
        {orders.slice(0, 5).map((order) => {
          const initials = (order.customer?.fullName || "C").trim().slice(0, 1).toUpperCase();
          return (
            <tr key={order.id} className="admin-table-row-clickable" onClick={() => go("orders")} title="Nhấn để xem chi tiết đơn hàng">
              <td className="admin-code">
                <span className="admin-order-code-badge">#{order.orderCode}</span>
              </td>
              <td>
                <div className="admin-table-customer">
                  <span className="admin-customer-avatar">{initials}</span>
                  <span>{order.customer?.fullName || "Customer"}</span>
                </div>
              </td>
              <td className="admin-order-total-cell">
                <strong>{money(order.totalAmount)}</strong>
              </td>
              <td>
                <OrderBadge status={order.status} order={order} />
              </td>
            </tr>
          );
        })}
      </Table>
    </section>
  );
}
