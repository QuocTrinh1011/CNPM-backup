import { showReturn } from "../../../shared/utils/order-display";
import { TicketPercent } from "lucide-react";
import { money, pageData, statusLabels, statusColors } from "../manager-data";
import { OrderBadge, PanelLoading, Table, ListError } from "../ManagerComponents";
import React from "react";
import { Users as UsersIcon, Package, ShoppingCart, MessageSquare, ClipboardList, ArrowRight, ChevronRight } from "lucide-react";
import { adminEndpoints } from "../../../api/manager-api";
import { useManagerList as useAdminList } from "../../../shared/hooks/useManagerResource";

const recentOrdersEndpoint = () => adminEndpoints.orders({ size: 100 });

const orderSummaryEndpoint = () => '/api/manager/orders/summary';

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
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("orders")} title="Đến trang xử lý đơn hàng">
            <div className="admin-quick-icon blue">
              <ShoppingCart size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Xử lý đơn hàng</b>
              <small>Theo dõi giao hàng & trạng thái</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("products")} title="Đến trang quản lý sản phẩm">
            <div className="admin-quick-icon green">
              <Package size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Kho sản phẩm</b>
              <small>Quản lý giá bán & tồn kho</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("vouchers")} title="Đến trang Voucher">
            <div className="admin-quick-icon violet">
              <TicketPercent size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Voucher cửa hàng</b>
              <small>Quản lý mã và lượt sử dụng</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("users")} title="Đến danh sách khách hàng">
            <div className="admin-quick-icon amber">
              <UsersIcon size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Hồ sơ khách hàng</b>
              <small>Tra cứu danh sách & phân quyền</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("surveys")} title="Đến trang khảo sát ý kiến">
            <div className="admin-quick-icon cyan">
              <ClipboardList size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Khảo sát ý kiến</b>
              <small>Tạo câu hỏi & xem phản hồi</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("feedback")} title="Đến trang phản hồi đánh giá">
            <div className="admin-quick-icon rose">
              <MessageSquare size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Phản hồi đánh giá</b>
              <small>Duyệt & trả lời khách hàng</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
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
            <i style={{ background: statusColors[status] }} />
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
