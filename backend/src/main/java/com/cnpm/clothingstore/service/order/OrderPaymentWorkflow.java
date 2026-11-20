package com.cnpm.clothingstore.service.order;

import com.fasterxml.jackson.databind.JsonNode;
import com.cnpm.clothingstore.entity.*;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.*;
import java.time.*;
import java.util.*;
import com.cnpm.clothingstore.service.*;
import com.cnpm.clothingstore.service.OrderService.*;

public final class OrderPaymentWorkflow {
    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final PaymentAttemptRepository attempts;
    private final PaymentWebhookEventRepository webhookEvents;
    private final NotificationService notifications;
    private final PayosService payos;
    private final PaymentReconciliationService reconciliation;
    private final OrderAccess orderAccess;
    public OrderPaymentWorkflow(OrderRepository orders, PaymentRepository payments, PaymentAttemptRepository attempts, PaymentWebhookEventRepository webhookEvents, NotificationService notifications, PayosService payos, PaymentReconciliationService reconciliation, OrderAccess orderAccess) {
        this.orders = orders;
        this.payments = payments;
        this.attempts = attempts;
        this.webhookEvents = webhookEvents;
        this.notifications = notifications;
        this.payos = payos;
        this.reconciliation = reconciliation;
        this.orderAccess = orderAccess;
    }

    public PaymentView paymentDetails(User customer, Long id) {
        Order order = orderAccess.owned(customer, id);
        if (!"PAYOS".equals(order.getPaymentMethod())) throw new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", "Đơn hàng không dùng PayOS.");
        Payment payment = payments.findByOrderId(order.getId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", "Không tìm thấy thông tin thanh toán."));
        return OrderViewMapper.paymentView(order, payment);
    }

    public PaymentView syncPayment(User customer, Long id) {
        Order order = orders.findForStatusUpdate(id).filter(o -> Objects.equals(o.getCustomer().getId(), customer.getId()))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng."));
        if (!"PAYOS".equals(order.getPaymentMethod())) throw new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", "Đơn hàng không dùng PayOS.");
        Payment payment = payments.findByOrderId(id).orElseThrow();
        if (!"PAID".equals(order.getPaymentStatus()) && payment.getPaymentLinkId() != null) {
            PaymentAttempt attempt = attempts.findFirstByOrderIdOrderByIdDesc(id).orElse(null);
            if (attempt != null) {
                PayosService.ProviderPayment result = payos.getPayment(attempt.getPaymentLinkId());
                validateProvider(attempt, order, result);
                applyProviderStatus(order, payment, attempt, result.status(), result.amountPaid());
            }
        }
        return OrderViewMapper.paymentView(order, payment);
    }

    public PaymentView retryPayment(User customer, Long id) {
        Order order = orders.findForStatusUpdate(id).filter(o -> Objects.equals(o.getCustomer().getId(), customer.getId()))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng."));
        if(order.paymentReviewRequired)throw new ApiException(HttpStatus.CONFLICT,"PAYMENT_NEEDS_REVIEW","Thanh toán cần cửa hàng đối chiếu trước khi tạo mã mới.");
        if (!"PAYOS".equals(order.getPaymentMethod()) || order.getTotalAmount().signum() <= 0)
            throw new ApiException(HttpStatus.CONFLICT, "PAYMENT_NOT_RETRYABLE", "Đơn hàng không cần thanh toán qua PayOS.");
        if ("CANCELLED".equals(order.getStatus()) || Set.of("SHIPPED", "DELIVERING", "DELIVERED", "COMPLETED").contains(order.getStatus()) || "PAID".equals(order.getPaymentStatus()))
            throw new ApiException(HttpStatus.CONFLICT, "PAYMENT_NOT_RETRYABLE", "Đơn hàng không thể thanh toán lại.");
        Payment payment = payments.findByOrderId(id).orElseThrow();
        PaymentAttempt previous = attempts.findFirstByOrderIdOrderByIdDesc(id).orElse(null);
        if (previous != null && payment.getPaymentLinkId() != null && previous.getPaymentLinkId() != null) {
            PayosService.ProviderPayment current = payos.getPayment(previous.getPaymentLinkId());
            validateProvider(previous, order, current);
            applyProviderStatus(order, payment, previous, current.status(), current.amountPaid());
            if(order.paymentReviewRequired)return OrderViewMapper.paymentView(order,payment);
            if ("PAID".equals(order.getPaymentStatus())) return OrderViewMapper.paymentView(order, payment);
            if ("PENDING".equals(order.getPaymentStatus()) && order.getExpiresAt() != null && order.getExpiresAt().isAfter(Instant.now()))
                return OrderViewMapper.paymentView(order, payment);
            if ("PENDING".equalsIgnoreCase(current.status()) || "PROCESSING".equalsIgnoreCase(current.status())) {
                payos.cancelPaymentLink(previous.getPaymentLinkId());
                previous.setStatus("CANCELLED"); previous.setUpdatedAt(Instant.now()); attempts.save(previous);
            }
        }
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(15));
        order.setExpiresAt(expiresAt);
        long providerCode = nextProviderCode();
        PayosService.Link link = payos.createPaymentLink(order, providerCode);
        payment.setPaymentLinkId(link.paymentLinkId()); payment.setCheckoutUrl(link.checkoutUrl()); payment.setQrCode(link.qrCode());
        payment.setExpiresAt(expiresAt); payment.setStatus("PENDING"); payment.setUpdatedAt(Instant.now());
        order.setPaymentStatus("PENDING"); order.setUpdatedAt(Instant.now());
        payments.save(payment); orders.save(order); saveAttempt(order, providerCode, link, expiresAt);
        return OrderViewMapper.paymentView(order, payment);
    }

    public void saveAttempt(Order order, long providerCode, PayosService.Link link, Instant expiresAt) {
        PaymentAttempt attempt = new PaymentAttempt(); attempt.setOrder(order); attempt.setProviderOrderCode(providerCode);
        attempt.setPaymentLinkId(link.paymentLinkId()); attempt.setCheckoutUrl(link.checkoutUrl()); attempt.setQrCode(link.qrCode());
        attempt.setExpiresAt(expiresAt); attempts.save(attempt);
    }

    public long nextProviderCode() {
        long code = 100000000000L + java.util.concurrent.ThreadLocalRandom.current().nextLong(89999999999L);
        while (orders.findByOrderCode(code).isPresent() || attempts.existsByProviderOrderCode(code)) code++;
        return code;
    }

    public void validateProvider(PaymentAttempt attempt, Order order, PayosService.ProviderPayment result) {
        if (result.orderCode() != attempt.getProviderOrderCode() || result.amount() != order.getTotalAmount().longValueExact() ||
            !Objects.equals(result.paymentLinkId(),attempt.getPaymentLinkId()))
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", "PayOS trả thông tin giao dịch không khớp.");
    }

    public void applyProviderStatus(Order order, Payment payment, PaymentAttempt attempt, String status, long amountPaid) {
        String normalized = status == null ? "" : status.toUpperCase(Locale.ROOT);
        if(amountPaid<0){PaymentReconciliationService.review(order,"PROVIDER_MISMATCH");orders.save(order);return;}
        if(amountPaid>0&&(!"PAID".equals(normalized)||amountPaid!=order.getTotalAmount().longValueExact())){
            PaymentReconciliationService.review(order,amountPaid>order.getTotalAmount().longValueExact()?"OVERPAYMENT":"PARTIAL_PAYMENT");orders.save(order);return;
        }
        if ("PAID".equals(normalized)) {
            if (amountPaid != order.getTotalAmount().longValueExact()) { PaymentReconciliationService.review(order,"PROVIDER_MISMATCH");orders.save(order);return; }
            reconciliation.paid(order,payment,attempt);
        } else if (Set.of("CANCELLED", "EXPIRED").contains(normalized)) {
            attempt.setStatus(normalized);
            if (!"PAID".equals(order.getPaymentStatus())) {
                order.setPaymentStatus(normalized); payment.setStatus(normalized);
            }
        }
        attempt.setUpdatedAt(Instant.now()); payment.setUpdatedAt(Instant.now()); order.setUpdatedAt(Instant.now());
        attempts.save(attempt); payments.save(payment); orders.save(order);
    }

    public boolean webhook(JsonNode payload, String signature) {
        JsonNode data = payload == null ? null : payload.path("data"); if (data == null || data.isMissingNode()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WEBHOOK", "Webhook không có dữ liệu thanh toán."); if (!payos.verifyWebhook(data, signature)) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WEBHOOK", "Chữ ký webhook không hợp lệ.");
        long code = data.path("orderCode").asLong(0); String providerCode = data.path("code").asText(""); boolean success = "00".equals(providerCode) && (!data.has("success") || data.path("success").asBoolean(false));
        PaymentAttempt attempt = attempts.findByProviderOrderCode(code).orElse(null);
        Long orderId = attempt == null ? orders.findIdByOrderCode(code).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WEBHOOK", "Không tìm thấy đơn hàng tương ứng.")) : attempt.getOrder().getId();
        // Load order state only after acquiring the lock, including legacy links without attempts.
        Order order = orders.findForStatusUpdate(orderId).orElseThrow();
        BigDecimal amount = BigDecimal.valueOf(data.path("amount").asLong(-1)); if (code == 0 || amount.compareTo(order.getTotalAmount()) != 0) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WEBHOOK", "Thông tin đơn hàng hoặc số tiền không khớp.");
        if (attempt != null && !data.path("paymentLinkId").asText("").isBlank() && !data.path("paymentLinkId").asText().equals(attempt.getPaymentLinkId()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WEBHOOK", "Mã giao dịch không khớp.");
        if (!"PAYOS".equals(order.getPaymentMethod())) return true;
        if ("PAID".equals(order.getPaymentStatus())) {
            if(success&&"00".equals(providerCode)&&attempt!=null&&!"PAID".equals(attempt.getStatus())){
                reconciliation.paid(order,payments.findByOrderId(order.getId()).orElseThrow(),attempt);
                PaymentReconciliationService.review(order,"MULTIPLE_PAYMENTS");
            }
            return true;
        }
        if ("CANCELLED".equals(order.getStatus())) {
            if (success && "00".equals(providerCode)) {
                Payment canceledPayment = payments.findByOrderId(order.getId()).orElseThrow();
                reconciliation.paid(order,canceledPayment,attempt);
                payments.save(canceledPayment); orders.save(order);
                log.error("PayOS payment succeeded after cancellation for order {}", order.getId());
            }
            return true;
        }
        String eventKey = data.path("paymentLinkId").asText("") + ":" + code + ":" + data.path("transactionDateTime").asText("") + ":" + providerCode; if (webhookEvents.existsByEventKey(eventKey)) return true; PaymentWebhookEvent event = new PaymentWebhookEvent(); event.setEventKey(eventKey); event.setOrderCode(code); webhookEvents.save(event);
        Payment payment = payments.findByOrderId(order.getId()).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WEBHOOK", "Không tìm thấy giao dịch."));
        if (success && "00".equals(providerCode)) {
            if (attempt != null && payment.getPaymentLinkId() != null && !payment.getPaymentLinkId().equals(attempt.getPaymentLinkId())) {
                try { payos.cancelPaymentLink(payment.getPaymentLinkId()); }
                catch (ApiException ex) { log.error("Could not cancel newer PayOS link for already-paid order {}", order.getId(), ex); }
            }
            reconciliation.paid(order,payment,attempt);
        } else {
            String desc = data.path("desc").asText("").toLowerCase(Locale.ROOT); String failedStatus = desc.contains("expire") ? "EXPIRED" : "CANCELLED";
            if (attempt != null) { attempt.setStatus(failedStatus); attempt.setUpdatedAt(Instant.now()); attempts.save(attempt); }
            if (attempt == null || Objects.equals(payment.getPaymentLinkId(), attempt.getPaymentLinkId())) {
                payment.setStatus(failedStatus); order.setPaymentStatus(failedStatus);
                notifications.create(order.getCustomer(), "Thanh toán chưa hoàn tất", "Đơn hàng #" + order.getOrderCode() + " chưa thanh toán thành công. Bạn có thể tạo mã mới hoặc hủy đơn.", "PAYMENT_FAILED", order.getId());
            }
        }
        payment.setUpdatedAt(Instant.now()); order.setUpdatedAt(Instant.now()); payments.save(payment); orders.save(order); return false;
    }
}
