import React, { useCallback } from "react";
import { adminApi, adminEndpoints } from "../manager-api";
import { useManagerList, useManagerResource } from "../useManagerResource";
import { showReturn } from "../order-display";
import { TicketPercent, Activity, Users as UsersIcon, Package, ShoppingCart, MessageSquare, ClipboardList, DollarSign, ArrowRight, RefreshCw, CircleAlert, AlertTriangle, ChevronRight } from "lucide-react";
import { money, pageData, Table, ListError, statusLabels, statusColors, OrderBadge, PanelLoading } from "./shared";

const recentOrdersEndpoint = () => adminEndpoints.orders({ size: 100 });
const orderSummaryEndpoint = () => "/api/manager/orders/summary";

export function Dashboard({ go }) {
  const fetchDashboard = useCallback(async signal => {
    const [revenue, users, surveys] = await Promise.all([
      adminApi(adminEndpoints.revenue, { signal }),
      adminApi(adminEndpoints.userReport, { signal }),
      adminApi(adminEndpoints.surveyStats, { signal }),
    ]);
    return { revenue, users, surveys };
  }, []);
  const { data, error, refreshing, load } = useManagerResource(fetchDashboard);
  if (error)
    return (
      <div className="admin-panel admin-error-state">
        <span className="admin-state-icon">
          <CircleAlert size={20} />
        </span>
        <h2>Không tải được dashboard</h2>
        <p>{error}</p>
        <button className="admin-primary" onClick={() => load()}>
          THỬ LẠI
        </button>
      </div>
    );
  if (!data) return <PanelLoading />;
  return (
    <div className="admin-content">
      {/* Dashboard Toolbar with Refresh & Status */}
      <div className="admin-dashboard-toolbar">
        <div className="admin-dashboard-toolbar-left">
          <span className="admin-kpi-headline">CHỈ SỐ HOẠT ĐỘNG TOÀN HỆ THỐNG</span>
        </div>
        <div className="admin-dashboard-toolbar-right">
          <button
            type="button"
            className="admin-btn-refresh"
            disabled={refreshing}
            onClick={() => load(true)}
            title="Đồng bộ dữ liệu mới nhất"
          >
            <RefreshCw size={13} className={refreshing ? "admin-spinner" : ""} />
            <span>{refreshing ? "Đang đồng bộ..." : "Cập nhật dữ liệu"}</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="admin-stat-grid">
        <Stat
          label="Tổng khách hàng"
          value={data.users.customers ?? "—"}
          icon={UsersIcon}
          color="blue"
          detail="Tài khoản customer trong hệ thống"
          onClick={() => go("users")}
        />
        <Stat
          label="Giá trị đơn chưa hủy"
          value={money(data.revenue.totalRevenue)}
          icon={DollarSign}
          color="green"
          detail="Tổng giá trị đơn chưa hủy; không phải tiền đã thu"
          onClick={() => go("reports")}
        />
        <Stat
          label="Tổng đơn hàng"
          value={data.revenue.orders ?? "—"}
          icon={ShoppingCart}
          color="violet"
          detail="Tất cả trạng thái đơn hàng"
          onClick={() => go("orders")}
        />
        <Stat
          label="Khảo sát đã phát hành"
          value={data.surveys.published ?? "—"}
          icon={ClipboardList}
          color="amber"
          detail={`${data.surveys.total ?? 0} khảo sát trong hệ thống`}
          onClick={() => go("surveys")}
        />
      </div>

      {/* Operational Alert if Locked Customers Exist */}
      {Number(data.users.lockedCustomers) > 0 && (
        <div className="admin-operational-alert">
          <div className="admin-operational-alert-icon">
            <AlertTriangle size={18} />
          </div>
          <div className="admin-operational-alert-content">
            <strong>Thông báo an toàn & tài khoản</strong>
            <p>Hệ thống ghi nhận {data.users.lockedCustomers} tài khoản khách hàng đang bị khóa do vi phạm hoặc yêu cầu quản trị.</p>
          </div>
          <button type="button" className="admin-operational-alert-btn" onClick={() => go("users")}>
            Kiểm tra tài khoản <ArrowRight size={13} />
          </button>
        </div>
      )}

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
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("vouchers")} title="Đến trang mã giảm giá">
            <div className="admin-quick-icon violet">
              <TicketPercent size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Mã giảm giá shop</b>
              <small>Khuyến mãi & voucher ưu đãi</small>
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
          <div className="admin-quick-card" role="button" tabIndex={0} onClick={() => go("reports")} title="Đến trang báo cáo khách hàng">
            <div className="admin-quick-icon indigo">
              <Activity size={18} />
            </div>
            <div className="admin-quick-text">
              <b>Báo cáo khách hàng</b>
              <small>Khách hàng, khảo sát & giữ chân</small>
            </div>
            <ChevronRight size={16} className="admin-quick-arrow" />
          </div>
        </div>
      </section>

      {/* Overview Grid: Surveys & Accounts */}
      <div className="admin-overview-grid">
        <section className="admin-panel admin-survey-overview">
          <div className="admin-section-heading">
            <div>
              <h2>Tổng quan khảo sát</h2>
              <p>Theo trạng thái phát hành</p>
            </div>
            <button className="admin-action" onClick={() => go("surveys")}>
              Quản lý khảo sát <ArrowRight size={14} />
            </button>
          </div>
          {[
            ["Đã phát hành", data.surveys.published, "#3b82f6"],
            ["Bản nháp", data.surveys.draft, "#8b5cf6"],
          ].map(([label, count, color]) => {
            const percent = data.surveys.total
              ? Math.round((Number(count || 0) / data.surveys.total) * 100)
              : 0;
            return (
              <div className="admin-metric-row" key={label}>
                <div>
                  <span className="admin-metric-label">
                    <i style={{ background: color }} />
                    {label}
                  </span>
                  <b>
                    {count ?? 0}{" "}
                    <small className="admin-metric-pct">({percent}%)</small>
                  </b>
                </div>
                <div className="admin-progress">
                  <span
                    style={{
                      width: `${percent}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
          <small className="admin-data-note">
            Giá trị đơn chưa hủy không phải tiền đã thu; API hiện chưa cung cấp
            giá trị đơn theo tháng.
          </small>
        </section>
        <section className="admin-panel admin-account-overview">
          <div className="admin-section-heading">
            <div>
              <h2>Tài khoản hệ thống</h2>
              <p>Dữ liệu báo cáo hiện tại</p>
            </div>
            <button className="admin-action" onClick={() => go("users")}>
              Quản lý tài khoản <ArrowRight size={14} />
            </button>
          </div>
          <div className="admin-account-total">
            <UsersIcon size={28} />
            <strong>{data.users.customers ?? "—"}</strong>
            <span>khách hàng</span>
          </div>
          <div className="admin-summary-line">
            <span>Nhân viên quản lý</span>
            <b>{data.users.admins ?? "—"}</b>
          </div>
          <div className="admin-summary-line">
            <span>Tài khoản bị khóa</span>
            <b style={{ color: Number(data.users.lockedCustomers) > 0 ? "#ef4444" : "inherit" }}>
              {data.users.lockedCustomers ?? "—"}
            </b>
          </div>
        </section>
      </div>

      {/* Recent Orders Component */}
      <RecentOrders go={go} />
    </div>
  );
}
function RecentOrders({ go }) {
  const { data, loading, error, load } = useManagerList(recentOrdersEndpoint);
  const {data:summary} = useManagerList(orderSummaryEndpoint);
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
function Stat({ label, value, icon: Icon, color, detail, onClick }) {
  return (
    <div
      className={`admin-stat ${onClick ? "is-clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={onClick ? `Xem chi tiết: ${label}` : undefined}
    >
      <div className={`admin-kpi-icon ${color}`}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div className="admin-stat-body">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      {onClick && <ArrowRight size={14} className="admin-stat-arrow" aria-hidden="true" />}
    </div>
  );
}
