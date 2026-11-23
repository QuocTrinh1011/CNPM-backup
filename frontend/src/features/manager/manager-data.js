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
  COD: "Tiền mặt COD",
  PAYOS: "PayOS QR",
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
