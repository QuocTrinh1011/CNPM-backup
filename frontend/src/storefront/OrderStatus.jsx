import React from "react";
import { showReturn, displayOrderLabel } from "../order-display";

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

export function Status({ value, order }) {
  return (
    <span className={`status-pill ${showReturn(order) ? "return-requested" : String(value).toLowerCase()}`}>
      {order ? displayOrderLabel(order, labels) : labels[value] || value}
    </span>
  );
}
