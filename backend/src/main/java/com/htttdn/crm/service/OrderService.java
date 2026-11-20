package com.htttdn.crm.service;

import com.htttdn.crm.service.order.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.*;
import org.springframework.data.domain.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.*;
import java.time.*;
import java.util.*;

@Service
public class OrderService {
    private final OrderAccess orderAccess;
    private final OrderPaymentWorkflow orderPaymentWorkflow;
    private final OrderHistoryQuery orderHistoryQuery;
    private final OrderCheckoutWorkflow orderCheckoutWorkflow;
    private final CustomerOrderActions customerOrderActions;
    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private static final BigDecimal SHIPPING_FEE = new BigDecimal("30000.00");
    private static final Set<String> CUSTOMER_CANCELLABLE_STATUSES = Set.of("PENDING_PAYMENT", "PENDING", "CONFIRMED", "PREPARING");
    private final OrderRepository orders;
    @org.springframework.beans.factory.annotation.Autowired private AbandonedOrderWorker expiryWorker;

    @org.springframework.beans.factory.annotation.Autowired
    public OrderService(OrderRepository orders, ProductRepository products, CartItemRepository carts,
                        PaymentRepository payments, PaymentAttemptRepository attempts, PaymentWebhookEventRepository webhookEvents,
                        VoucherService vouchers, NotificationService notifications, PayosService payos, FeedbackRepository feedback, AuditTrail audit, StockService stock, PaymentReconciliationService reconciliation) {
        this.orders = orders; this.orderAccess = new OrderAccess(orders);
        this.orderPaymentWorkflow = new OrderPaymentWorkflow(orders, payments, attempts, webhookEvents, notifications, payos, reconciliation, orderAccess);
        this.orderHistoryQuery = new OrderHistoryQuery(orders);
        this.orderCheckoutWorkflow = new OrderCheckoutWorkflow(orders, products, carts, payments, vouchers, notifications, payos, stock, orderPaymentWorkflow);
        this.customerOrderActions = new CustomerOrderActions(orders, payments, attempts, vouchers, notifications, payos, feedback, audit, stock, orderAccess, orderPaymentWorkflow);
    }

    @Transactional
    public Checkout create(User customer, CheckoutRequest request) {
        return orderCheckoutWorkflow.create(customer, request);
    }

    @Transactional(readOnly = true)
    public Page<OrderView> history(User customer, int page, int size, String requestedTab, String requestedKeyword) {
        return orderHistoryQuery.history(customer, page, size, requestedTab, requestedKeyword);
    }
    @Transactional(readOnly = true) public OrderView detail(User customer, Long id) { return view(orderAccess.owned(customer, id)); }

    @Transactional(readOnly = true) public PaymentView paymentDetails(User customer, Long id) {
        return orderPaymentWorkflow.paymentDetails(customer, id);
    }



    @Transactional public PaymentView syncPayment(User customer, Long id) {
        return orderPaymentWorkflow.syncPayment(customer, id);
    }

    @Transactional public PaymentView retryPayment(User customer, Long id) {
        return orderPaymentWorkflow.retryPayment(customer, id);
    }









    @Transactional public OrderView cancel(User customer, Long id, String reason) {
        return customerOrderActions.cancel(customer, id, reason);
    }

    // customer is resolved by AuthService, never from a client-supplied actor header/body.




    @Transactional public OrderView confirmReceipt(User customer, Long id) {
        return customerOrderActions.confirmReceipt(customer, id);
    }

    @Transactional public OrderView requestReturn(User customer, Long id, String reason) {
        return customerOrderActions.requestReturn(customer, id, reason);
    }

    @Transactional public boolean webhook(JsonNode payload, String signature) {
        return orderPaymentWorkflow.webhook(payload, signature);
    }

    @Scheduled(fixedDelayString = "${app.payment-cleanup-ms:300000}") public void cleanupExpired() {
        Instant now=Instant.now();long after=0;
        while(true){var ids=orders.expiredPendingIds(after,now,PageRequest.of(0,100));if(ids.isEmpty())return;
            for(Long id:ids){after=id;try{expiryWorker.expire(id,now);}catch(Exception ex){log.warn("Payment expiry failed for order {} ({})",id,ex.getClass().getSimpleName());}}
        }
    }









    public OrderView view(Order o) {
        return OrderViewMapper.view(o);
    }

    public record RequestedItem(Long productId, int quantity, String size, String color) {}
    public record CheckoutRequest(String deliveryAddress, String paymentMethod, String voucherCode, List<RequestedItem> items) {}
    public record Checkout(OrderView order, String paymentUrl, String paymentLinkId, String qrCode, Instant expiresAt) {}
    public record PaymentView(Long orderId, Long orderCode, String paymentStatus, BigDecimal amount, Instant expiresAt, String qrCode, String paymentUrl, boolean retryable, boolean reviewRequired) {}
    public record ReturnEventView(String status,String note,Instant createdAt) {}
    public record OrderView(Long id, Long orderCode, String status, String paymentStatus, String paymentMethod, String deliveryAddress, String trackingCode, String cancelReason, String returnStatus, String returnReason, String voucherCode, BigDecimal discountAmount, BigDecimal shippingFee, BigDecimal totalAmount, Instant createdAt, Instant updatedAt, List<OrderLineView> items, Instant returnRequestedAt, List<ReturnEventView> returnHistory) {}
    public record OrderLineView(Long productId, String name, String imageUrl, int quantity, BigDecimal unitPrice, BigDecimal lineTotal, String size, String color) {}
}
