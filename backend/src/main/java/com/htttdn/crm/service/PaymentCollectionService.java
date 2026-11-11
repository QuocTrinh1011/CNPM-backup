package com.htttdn.crm.service;

import com.htttdn.crm.entity.Order;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.OrderRepository;
import com.htttdn.crm.repository.PaymentRepository;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentCollectionService {
  private final OrderRepository orders;
  private final PaymentRepository payments;
  private final AuditTrail audit;

  public PaymentCollectionService(
      OrderRepository orders, PaymentRepository payments, AuditTrail audit) {
    this.orders = orders;
    this.payments = payments;
    this.audit = audit;
  }

  @Transactional
  public void confirmCod(Long id, String note) {
    var actor = AuditTrail.actor();
    if (actor == null || !"MANAGER".equals(actor.role()))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "MANAGER_REQUIRED", "Chỉ Manager được xác nhận thu COD.");
    String cleanNote = note == null ? "" : note.trim();
    if (cleanNote.isEmpty() || cleanNote.length() > 1000)
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "INVALID_PAYMENT_NOTE",
          "Vui lòng nhập ghi chú tối đa 1.000 ký tự.");

    Order order =
        orders
            .findForStatusUpdate(id)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng."));
    if (!"COD".equals(order.getPaymentMethod())
        || !Set.of("DELIVERED", "COMPLETED").contains(order.getStatus()))
      throw new ApiException(
          HttpStatus.CONFLICT,
          "COD_NOT_COLLECTIBLE",
          "Chỉ xác nhận thu COD cho đơn đã giao hoặc hoàn thành.");
    if (order.codCollectedAt != null) return;

    order.codCollectedAmount = order.getTotalAmount();
    order.codCollectedAt = Instant.now();
    order.codCollectedBy = actor.id();
    order.codCollectionNote = cleanNote;
    order.setPaymentStatus("PAID");
    order.setUpdatedAt(Instant.now());
    payments
        .findByOrderId(id)
        .ifPresent(
            payment -> {
              payment.setStatus("PAID");
              payment.setUpdatedAt(Instant.now());
              payments.save(payment);
            });
    orders.save(order);
    audit.record(
        "COD_COLLECTED", "ORDER", id, Map.of(), Map.of("amount", order.codCollectedAmount));
  }
}
