package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class AbandonedOrderWorker {
  private final OrderRepository orders;
  private final PaymentRepository payments;
  private final PaymentAttemptRepository attempts;
  private final StockService stock;
  private final VoucherService vouchers;
  private final NotificationService notifications;
  private final PaymentReconciliationService reconciliation;

  public AbandonedOrderWorker(
      OrderRepository orders,
      PaymentRepository payments,
      PaymentAttemptRepository attempts,
      StockService stock,
      VoucherService vouchers,
      NotificationService notifications,
      PaymentReconciliationService reconciliation) {
    this.orders = orders;
    this.payments = payments;
    this.attempts = attempts;
    this.stock = stock;
    this.vouchers = vouchers;
    this.notifications = notifications;
    this.reconciliation = reconciliation;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public String cancel(Long id, Instant now, Duration grace) {
    Order o = orders.findForStatusUpdate(id).orElse(null);
    if (o == null
        || !"PAYOS".equals(o.getPaymentMethod())
        || !Set.of("PENDING", "PENDING_PAYMENT").contains(o.getStatus())
        || !Set.of("PENDING", "EXPIRED", "FAILED", "CANCELLED")
            .contains(String.valueOf(o.getPaymentStatus()))) return "SKIPPED";
    Instant expiry = o.getExpiresAt();
    for (var a : attempts.findByOrderIdOrderByIdAsc(id))
      if (a.getExpiresAt() != null && (expiry == null || a.getExpiresAt().isAfter(expiry)))
        expiry = a.getExpiresAt();
    var payment = payments.findByOrderId(id).orElse(null);
    if (payment != null
        && payment.getExpiresAt() != null
        && (expiry == null || payment.getExpiresAt().isAfter(expiry)))
      expiry = payment.getExpiresAt();
    if (expiry == null || expiry.plus(grace).isAfter(now)) return "SKIPPED";
    var result = reconciliation.reconcile(o, true);
    if (result != PaymentReconciliationService.Result.UNPAID) return result.name();
    o.setStatus("CANCELLED");
    o.setPaymentStatus("CANCELLED");
    o.setCancelReason("Tự hủy do quá " + grace.toHours() + " giờ sau hạn thanh toán PayOS.");
    o.setUpdatedAt(now);
    payments
        .findByOrderId(id)
        .ifPresent(
            p -> {
              p.setStatus("CANCELLED");
              p.setUpdatedAt(now);
              payments.save(p);
            });
    stock.release(o);
    vouchers.release(o);
    orders.save(o);
    notifications.create(
        o.getCustomer(),
        "Đơn hàng tự động hủy",
        "Đơn #"
            + o.getOrderCode()
            + " đã quá thời gian thanh toán và được hủy; sản phẩm và lượt voucher đã được giải"
            + " phóng.",
        "ORDER_AUTO_CANCELLED",
        id);
    return "CANCELLED";
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void expire(Long id, Instant now) {
    var o = orders.findForStatusUpdate(id).orElse(null);
    if (o == null
        || !"PAYOS".equals(o.getPaymentMethod())
        || !"PENDING".equals(o.getPaymentStatus())
        || "CANCELLED".equals(o.getStatus())
        || o.getExpiresAt() == null
        || !o.getExpiresAt().isBefore(now)) return;
    payments
        .findByOrderId(id)
        .ifPresent(
            p -> {
              p.setStatus("EXPIRED");
              p.setUpdatedAt(now);
              payments.save(p);
            });
    attempts
        .findFirstByOrderIdOrderByIdDesc(id)
        .ifPresent(
            a -> {
              if ("PENDING".equals(a.getStatus())) {
                a.setStatus("EXPIRED");
                a.setUpdatedAt(now);
                attempts.save(a);
              }
            });
    o.setPaymentStatus("EXPIRED");
    o.setUpdatedAt(now);
    orders.save(o);
    notifications.create(
        o.getCustomer(),
        "Hết hạn thanh toán",
        "Liên kết thanh toán đơn #"
            + o.getOrderCode()
            + " đã hết hạn. Bạn có thể tạo mã mới hoặc hủy đơn.",
        "PAYMENT_EXPIRED",
        id);
  }
}
