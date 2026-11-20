package com.cnpm.clothingstore.service.order;

import com.cnpm.clothingstore.entity.*;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;

import java.math.*;
import java.time.*;
import java.util.*;
import com.cnpm.clothingstore.service.*;
import com.cnpm.clothingstore.service.OrderService.*;

public final class CustomerOrderActions {
    private static final Set<String> CUSTOMER_CANCELLABLE_STATUSES = Set.of("PENDING_PAYMENT", "PENDING", "CONFIRMED", "PREPARING");
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final PaymentAttemptRepository attempts;
    private final VoucherService vouchers;
    private final NotificationService notifications;
    private final PayosService payos;
    private final FeedbackRepository feedback;
    private final AuditTrail audit;
    private final StockService stock;
    private final OrderAccess orderAccess;
    private final OrderPaymentWorkflow orderPaymentWorkflow;
    public CustomerOrderActions(OrderRepository orders, PaymentRepository payments, PaymentAttemptRepository attempts, VoucherService vouchers, NotificationService notifications, PayosService payos, FeedbackRepository feedback, AuditTrail audit, StockService stock, OrderAccess orderAccess, OrderPaymentWorkflow orderPaymentWorkflow) {
        this.orders = orders;
        this.payments = payments;
        this.attempts = attempts;
        this.vouchers = vouchers;
        this.notifications = notifications;
        this.payos = payos;
        this.feedback = feedback;
        this.audit = audit;
        this.stock = stock;
        this.orderAccess = orderAccess;
        this.orderPaymentWorkflow = orderPaymentWorkflow;
    }

    public OrderView cancel(User customer, Long id, String reason) {
        Order order = orders.findForStatusUpdate(id).filter(o -> Objects.equals(o.getCustomer().getId(), customer.getId())).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"ORDER_NOT_FOUND","Không tìm thấy đơn hàng.")); if ("CANCELLED".equals(order.getStatus())) return OrderViewMapper.view(order); if(order.paymentReviewRequired)throw new ApiException(HttpStatus.CONFLICT,"PAYMENT_NEEDS_REVIEW","Cần cửa hàng đối chiếu thanh toán trước khi hủy đơn."); if (!CUSTOMER_CANCELLABLE_STATUSES.contains(order.getStatus())) throw new ApiException(HttpStatus.CONFLICT, "ORDER_CANNOT_CANCEL", "Đơn hàng đã chuyển sang giao hàng hoặc đã hoàn tất nên không thể hủy.");
        if ("PAYOS".equals(order.getPaymentMethod()) && !"PAID".equals(order.getPaymentStatus())) {
            Payment payment = payments.findByOrderId(order.getId()).orElse(null);
            PaymentAttempt latest = attempts.findFirstByOrderIdOrderByIdDesc(order.getId()).orElse(null);
            if (payment != null && latest != null && latest.getPaymentLinkId() != null) {
                PayosService.ProviderPayment current = payos.getPayment(latest.getPaymentLinkId());
                orderPaymentWorkflow.validateProvider(latest, order, current);
                orderPaymentWorkflow.applyProviderStatus(order, payment, latest, current.status(), current.amountPaid());
                if(order.paymentReviewRequired)return OrderViewMapper.view(order);
                if ("PAID".equals(order.getPaymentStatus())) return OrderViewMapper.view(order);
                if ("PENDING".equalsIgnoreCase(current.status()) || "PROCESSING".equalsIgnoreCase(current.status())) {
                    payos.cancelPaymentLink(latest.getPaymentLinkId());
                    latest.setStatus("CANCELLED"); latest.setUpdatedAt(Instant.now()); attempts.save(latest);
                }
            }
        }
        var before = AuditTrail.snapshot(order);
        boolean paid = "PAID".equals(order.getPaymentStatus());
        order.setStatus("CANCELLED");
        if (!paid) {
            order.setPaymentStatus("CANCELLED");
            payments.findByOrderId(order.getId()).ifPresent(payment -> { payment.setStatus("CANCELLED"); payment.setUpdatedAt(Instant.now()); payments.save(payment); });
        }
        order.setCancelReason(OrderInput.clean(reason) == null ? "Khách hàng yêu cầu hủy đơn." : OrderInput.clean(reason));
        stock.release(order, new AuditTrail.Actor(customer.getId(), customer.getFullName(), "CUSTOMER"));
        vouchers.release(order); order.setUpdatedAt(Instant.now()); orders.save(order);
        notifications.create(customer, "Đã hủy đơn hàng", "Đơn hàng #" + order.getOrderCode() + " đã được hủy."
            + (paid ? " Đơn đã thanh toán; hệ thống không tự xử lý khoản tiền đã thu. Vui lòng liên hệ cửa hàng để đối soát thủ công." : ""), "ORDER_CANCELLED", order.getId());
        recordCustomerAction(customer, "CUSTOMER_CANCEL", order, before);
        return OrderViewMapper.view(order);
    }

    public void recordCustomerAction(User customer, String action, Order order, Map<String,Object> before) {
        audit.recordAs(new AuditTrail.Actor(customer.getId(), customer.getFullName(), "CUSTOMER"),
            action, "ORDER", order.getId(), before, AuditTrail.snapshot(order));
    }

    public OrderView confirmReceipt(User customer, Long id) {
        Order order = orderAccess.lockedOwned(customer, id);
        if ("COMPLETED".equals(order.getStatus())) return OrderViewMapper.view(order);
        if (!"DELIVERED".equals(order.getStatus()) || (order.getReturnStatus() != null && !"NONE".equals(order.getReturnStatus())))
            throw new ApiException(HttpStatus.CONFLICT, "RECEIPT_NOT_ALLOWED", "Chỉ xác nhận đơn đã giao và chưa có yêu cầu đổi trả. Vui lòng tải lại đơn hàng.");
        var before = AuditTrail.snapshot(order);
        order.setStatus("COMPLETED"); order.setUpdatedAt(Instant.now()); orders.save(order);
        notifications.create(customer, "Đơn hàng hoàn thành", "Bạn đã xác nhận nhận hàng cho đơn #" + order.getOrderCode() + ".", "ORDER_COMPLETED", order.getId());
        recordCustomerAction(customer, "CUSTOMER_RECEIPT", order, before);
        return OrderViewMapper.view(order);
    }

    public OrderView requestReturn(User customer, Long id, String reason) {
        Order order = orderAccess.lockedOwned(customer, id); if (!Set.of("DELIVERED", "COMPLETED").contains(order.getStatus())) throw new ApiException(HttpStatus.CONFLICT, "RETURN_NOT_ALLOWED", "Chỉ có thể yêu cầu đổi trả sau khi đã nhận hàng."); if (order.getReturnStatus() != null && !"NONE".equals(order.getReturnStatus())) throw new ApiException(HttpStatus.CONFLICT, "RETURN_ALREADY_REQUESTED", "Đơn hàng đã có yêu cầu đổi trả.");
        if ("COMPLETED".equals(order.getStatus()) && feedback.existsByOrderId(order.getId()))
            throw new ApiException(HttpStatus.CONFLICT, "RETURN_AFTER_REVIEW_NOT_ALLOWED", "Đơn đã xác nhận nhận hàng và đã đánh giá sản phẩm nên không thể yêu cầu đổi trả.");
        order.setReturnStatus("REQUESTED"); order.setReturnReason(reason.trim()); order.setReturnRequestedAt(Instant.now()); order.setUpdatedAt(Instant.now()); orders.save(order); notifications.create(customer, "Đã tiếp nhận yêu cầu đổi trả", "Yêu cầu đổi trả đơn #" + order.getOrderCode() + " đang chờ xử lý.", "RETURN_REQUESTED", order.getId()); return OrderViewMapper.view(order);
    }
}
