package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class RefundService {
  private final OrderRepository orders;
  private final OrderRefundRepository refunds;
  private final PaymentRepository payments;
  private final NotificationService notifications;
  private final AuditTrail audit;

  public RefundService(
      OrderRepository orders,
      OrderRefundRepository refunds,
      PaymentRepository payments,
      NotificationService notifications,
      AuditTrail audit) {
    this.orders = orders;
    this.refunds = refunds;
    this.payments = payments;
    this.notifications = notifications;
    this.audit = audit;
  }

  public record Input(
      @Size(max = 10) String reasonType,
      @DecimalMin("0.0") BigDecimal amount,
      @Size(max = 1000) String note,
      @Size(max = 100) String requestKey) {}

  public record Process(@Size(max = 120) String bankReference, @Size(max = 1000) String note) {}

  public record Summary(
      String status,
      BigDecimal refundedAmount,
      BigDecimal pendingAmount,
      BigDecimal availableAmount) {}

  public record View(
      Long id,
      Long orderId,
      Long orderCode,
      String customerName,
      String customerEmail,
      String reasonType,
      BigDecimal amount,
      String status,
      String note,
      String processingNote,
      String bankReference,
      Long requestedBy,
      Long processedBy,
      Instant requestedAt,
      Instant processedAt) {}

  public static BigDecimal collected(Order o) {
    return "PAYOS".equals(o.getPaymentMethod()) && "PAID".equals(o.getPaymentStatus())
        ? o.getTotalAmount()
        : "COD".equals(o.getPaymentMethod()) && o.codCollectedAt != null
            ? o.codCollectedAmount
            : BigDecimal.ZERO;
  }

  public static Summary summary(Order o) {
    return new Summary(
        o.refundStatus,
        o.refundedAmount,
        o.refundPendingAmount,
        collected(o)
            .subtract(o.refundedAmount)
            .subtract(o.refundPendingAmount)
            .max(BigDecimal.ZERO));
  }

  private ApiException bad(String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REFUND", message);
  }

  private ApiException conflict(String message) {
    return new ApiException(HttpStatus.CONFLICT, "REFUND_CONFLICT", message);
  }

  private Order locked(Long id) {
    return orders
        .findForStatusUpdate(id)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng."));
  }

  private AuditTrail.Actor actor() {
    var a = AuditTrail.actor();
    if (a == null || !"MANAGER".equals(a.role()))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "MANAGER_REQUIRED", "Chỉ Manager được xử lý hoàn tiền.");
    return a;
  }

  private String text(String value, int max, boolean required) {
    String s = value == null ? "" : value.trim();
    if (s.length() > max || required && s.isEmpty())
      throw bad("Vui lòng nhập đủ thông tin, không vượt độ dài cho phép.");
    return s;
  }

  private View view(OrderRefund r) {
    var c = r.order.getCustomer();
    return new View(
        r.id,
        r.order.getId(),
        r.order.getOrderCode(),
        c.getFullName(),
        c.getEmail(),
        r.reasonType,
        r.amount,
        r.status,
        r.note,
        r.processingNote,
        r.bankReference,
        r.requestedBy,
        r.processedBy,
        r.requestedAt,
        r.processedAt);
  }

  @Transactional(readOnly = true)
  public Page<View> list(String status, String q, int page, int size) {
    if (page < 0
        || size < 1
        || size > 100
        || q.length() > 120
        || !Set.of("", "PENDING", "COMPLETED", "REJECTED").contains(status))
      throw bad("Bộ lọc không hợp lệ.");
    return refunds
        .findAll(
            (root, query, cb) -> {
              var o = root.join("order");
              var c = o.join("customer");
              var p = new ArrayList<jakarta.persistence.criteria.Predicate>();
              if (!status.isEmpty()) p.add(cb.equal(root.get("status"), status));
              if (!q.isBlank()) {
                String s =
                    "%"
                        + q.trim()
                            .toLowerCase(Locale.ROOT)
                            .replace("!", "!!")
                            .replace("%", "!%")
                            .replace("_", "!_")
                        + "%";
                p.add(
                    cb.or(
                        cb.like(cb.lower(c.get("fullName")), s, '!'),
                        cb.like(cb.lower(c.get("email")), s, '!'),
                        cb.like(o.get("orderCode").as(String.class), s, '!')));
              }
              return cb.and(p.toArray(jakarta.persistence.criteria.Predicate[]::new));
            },
            PageRequest.of(page, size, Sort.by("id").descending()))
        .map(this::view);
  }

  @Transactional(readOnly = true)
  public List<View> forOrder(Long id) {
    return refunds.findByOrderIdOrderByIdDesc(id).stream().map(this::view).toList();
  }

  @Transactional
  public View create(Long id, Input input) {
    if (input == null) throw bad("Thiếu thông tin khoản hoàn.");
    var a = actor();
    Order o = locked(id);
    String type = text(input.reasonType(), 10, true),
        note = text(input.note(), 1000, true),
        key = text(input.requestKey(), 100, true);
    if (key.startsWith("AUTO_") || !Set.of("CANCEL", "RETURN").contains(type))
      throw bad("Nguồn hoàn tiền hoặc mã yêu cầu không hợp lệ.");
    var existing = refunds.findByOrderIdAndRequestKey(id, key);
    if (existing.isPresent()) {
      var r = existing.get();
      if (!Objects.equals(r.reasonType, type)
          || !Objects.equals(r.note, note)
          || input.amount() == null
          || r.amount.compareTo(input.amount()) != 0)
        throw conflict("Mã yêu cầu đã được dùng cho nội dung khác.");
      return view(r);
    }
    if ("CANCEL".equals(type)
        ? !"CANCELLED".equals(o.getStatus())
        : !Set.of("APPROVED", "COMPLETED").contains(String.valueOf(o.getReturnStatus())))
      throw conflict("Đơn chưa đủ điều kiện hoàn tiền.");
    OrderRefund r = insert(o, type, input.amount(), note, key, a.id());
    audit.record(
        "REFUND_REQUEST",
        "ORDER",
        id,
        Map.of(),
        Map.of("refundId", r.id, "amount", r.amount, "reasonType", type));
    return view(r);
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void requestCancellation(Order o) {
    if (!"CANCELLED".equals(o.getStatus())
        || !"PAYOS".equals(o.getPaymentMethod())
        || !"PAID".equals(o.getPaymentStatus())
        || o.getTotalAmount().signum() == 0) return;
    if (refunds.findByOrderIdAndRequestKey(o.getId(), "AUTO_CANCEL").isPresent()) return;
    insert(
        o,
        "CANCEL",
        o.getTotalAmount(),
        "Đơn đã thanh toán bị hủy; cần hoàn tiền thủ công.",
        "AUTO_CANCEL",
        AuditTrail.actor() == null ? null : AuditTrail.actor().id());
  }

  private OrderRefund insert(
      Order o, String type, BigDecimal amount, String note, String key, Long actor) {
    if (amount == null || amount.signum() <= 0 || amount.stripTrailingZeros().scale() > 0)
      throw bad("Số tiền hoàn phải là số nguyên dương (VND).");
    recompute(o);
    if (amount.compareTo(summary(o).availableAmount()) > 0)
      throw conflict("Số tiền hoàn vượt số tiền đã thu còn có thể hoàn.");
    var r = new OrderRefund();
    r.order = o;
    r.reasonType = type;
    r.amount = amount;
    r.note = note;
    r.requestKey = key;
    r.requestedBy = actor;
    refunds.saveAndFlush(r);
    recompute(o);
    return r;
  }

  @Transactional
  public View process(Long id, Process input, boolean complete) {
    if (input == null) throw bad("Thiếu thông tin xử lý.");
    var a = actor();
    Long oid =
        refunds
            .orderId(id)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "REFUND_NOT_FOUND", "Không tìm thấy khoản hoàn."));
    Order o = locked(oid);
    OrderRefund r = refunds.findById(id).orElseThrow();
    String note = text(input.note(), 1000, true),
        reference = text(input.bankReference(), 120, complete),
        next = complete ? "COMPLETED" : "REJECTED";
    if (!complete) reference = "";
    if (!"PENDING".equals(r.status)) {
      if (next.equals(r.status)
          && note.equals(r.processingNote)
          && reference.equals(r.bankReference)) return view(r);
      throw conflict("Khoản hoàn đã được xử lý với nội dung khác.");
    }
    var before = Map.<String, Object>of("refundId", r.id, "status", r.status);
    r.status = next;
    r.processingNote = note;
    r.bankReference = reference;
    r.processedBy = a.id();
    r.processedAt = Instant.now();
    refunds.saveAndFlush(r);
    recompute(o);
    if (complete)
      notifications.create(
          o.getCustomer(),
          "Đã ghi nhận hoàn tiền",
          "Đơn #"
              + o.getOrderCode()
              + ": đã hoàn "
              + r.amount.toPlainString()
              + " đ; tổng đã hoàn "
              + o.refundedAmount.toPlainString()
              + " đ.",
          "REFUND_COMPLETED",
          oid);
    audit.record(
        complete ? "REFUND_COMPLETE" : "REFUND_REJECT",
        "ORDER",
        oid,
        before,
        Map.of("refundId", r.id, "status", next, "amount", r.amount));
    return view(r);
  }

  private void recompute(Order o) {
    o.refundedAmount = refunds.total(o.getId(), "COMPLETED");
    o.refundPendingAmount = refunds.total(o.getId(), "PENDING");
    o.refundStatus =
        o.refundedAmount.signum() > 0
            ? (o.refundedAmount.compareTo(collected(o)) >= 0 ? "FULL" : "PARTIAL")
            : o.refundPendingAmount.signum() > 0 ? "PENDING" : "NONE";
    orders.save(o);
  }

  @Transactional
  public void confirmCod(Long id, String note) {
    var a = actor();
    Order o = locked(id);
    String clean = text(note, 1000, true);
    if (!"COD".equals(o.getPaymentMethod())
        || !Set.of("DELIVERED", "COMPLETED").contains(o.getStatus()))
      throw conflict("Chỉ xác nhận thu COD cho đơn đã giao hoặc hoàn thành.");
    if (o.codCollectedAt != null) return;
    o.codCollectedAmount = o.getTotalAmount();
    o.codCollectedAt = Instant.now();
    o.codCollectedBy = a.id();
    o.codCollectionNote = clean;
    o.setPaymentStatus("PAID");
    o.setUpdatedAt(Instant.now());
    payments
        .findByOrderId(id)
        .ifPresent(
            p -> {
              p.setStatus("PAID");
              p.setUpdatedAt(Instant.now());
              payments.save(p);
            });
    orders.save(o);
    audit.record("COD_COLLECTED", "ORDER", id, Map.of(), Map.of("amount", o.codCollectedAmount));
  }
}
