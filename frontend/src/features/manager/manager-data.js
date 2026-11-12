import { canAdvanceOrder } from "./order-transitions";

export const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
export const pageData = (value) => value?.content || [];

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
export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
