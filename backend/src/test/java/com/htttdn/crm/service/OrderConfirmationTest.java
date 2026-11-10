package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.exception.ApiException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrderConfirmationTest {
    @Test void lateSuccessfulWebhookAfterCancellationNotifiesOnlyOnce() throws Exception {
        Order order=paymentOrder("CANCELLED");Payment payment=new Payment();payment.setOrder(order);payment.setStatus("CANCELLED");
        when(orders.findIdByOrderCode(9009L)).thenReturn(Optional.of(9L));
        when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        when(payments.findByOrderId(9L)).thenReturn(Optional.of(payment));when(payos.verifyWebhook(any(),any())).thenReturn(true);
        var payload=new ObjectMapper().readTree("{\"success\":true,\"data\":{\"orderCode\":9009,\"amount\":10,\"code\":\"00\"}}");
        service.webhook(payload,"test");service.webhook(payload,"test");
        assertEquals("CANCELLED",order.getStatus());assertEquals("PAID",order.getPaymentStatus());assertEquals("PAID",payment.getStatus());
        verify(notifications,times(1)).create(any(),anyString(),anyString(),eq("PAYMENT_AFTER_CANCEL"),eq(9L));
        verifyNoInteractions(vouchers,products);
    }
    @Test void customerReceiptIsOwnedIdempotentAndDoesNotChangePayment() {
        User customer = new User(); org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        User stranger = new User(); org.springframework.test.util.ReflectionTestUtils.setField(stranger,"id",3L);
        Order order = paymentOrder("DELIVERED"); order.setCustomer(customer); order.setPaymentMethod("COD"); order.setPaymentStatus("COD");
        when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        assertThrows(ApiException.class, () -> service.confirmReceipt(stranger,9L));
        assertEquals("COMPLETED",service.confirmReceipt(customer,9L).status());
        assertEquals("COMPLETED",service.confirmReceipt(customer,9L).status());
        assertEquals("COD",order.getPaymentStatus());
        verify(notifications,times(1)).create(eq(customer),anyString(),anyString(),eq("ORDER_COMPLETED"),eq(9L));
        verify(orders,times(1)).save(order); verifyNoInteractions(products,carts,vouchers,payos,payments);
        verify(audit,times(1)).recordAs(argThat(a->a.id().equals(2L)&&a.role().equals("CUSTOMER")),eq("CUSTOMER_RECEIPT"),eq("ORDER"),eq(9L),
            argThat(s->"DELIVERED".equals(s.get("status"))),argThat(s->"COMPLETED".equals(s.get("status"))));
    }
    @Test void receiptRejectsUndeliveredCancelledAndReturnRequests() {
        User customer = new User(); org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        for (String status : List.of("PENDING","CONFIRMED","SHIPPED","CANCELLED","DELIVERED")) {
            Order order = paymentOrder(status); order.setCustomer(customer);
            if (status.equals("DELIVERED")) order.setReturnStatus("REQUESTED");
            when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
            assertThrows(ApiException.class, () -> service.confirmReceipt(customer,9L));
            assertEquals(status,order.getStatus());
        }
        verifyNoInteractions(notifications,audit); verify(orders,never()).save(any());
    }
    final OrderRepository orders = mock(OrderRepository.class);
    final ProductRepository products = mock(ProductRepository.class);
    final CartItemRepository carts = mock(CartItemRepository.class);
    final PaymentRepository payments = mock(PaymentRepository.class);
    final PaymentAttemptRepository attempts = mock(PaymentAttemptRepository.class);
    final PaymentWebhookEventRepository events = mock(PaymentWebhookEventRepository.class);
    final VoucherService vouchers = mock(VoucherService.class);
    final NotificationService notifications = mock(NotificationService.class);
    final PayosService payos = mock(PayosService.class);
    final FeedbackRepository feedback = mock(FeedbackRepository.class);
    final AuditTrail audit = mock(AuditTrail.class);
    final StockService stock = new StockService(products,mock(jakarta.persistence.EntityManager.class));
    final PaymentReconciliationService reconciliation = new PaymentReconciliationService(payos,attempts,payments,notifications);
    final OrderService service = new OrderService(orders,products,carts,payments,attempts,events,vouchers,notifications,payos,feedback,audit,stock,reconciliation);

    @Test void completedReviewedOrderCannotRequestReturn() {
        User customer = new User(); org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        Order order = paymentOrder("COMPLETED"); order.setCustomer(customer);
        when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        when(feedback.existsByOrderId(9L)).thenReturn(true);
        assertEquals("RETURN_AFTER_REVIEW_NOT_ALLOWED", assertThrows(ApiException.class, () -> service.requestReturn(customer,9L,"Lỗi sản phẩm")).code());
        assertEquals("NONE",order.getReturnStatus());
        verify(orders,never()).save(any()); verifyNoInteractions(notifications);
    }

    @Test void deliveredOrCompletedWithoutReviewCanStillRequestReturn() {
        User customer = new User(); org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        for (String status : List.of("DELIVERED", "COMPLETED")) {
            Order order = paymentOrder(status); order.setCustomer(customer);
            when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
            assertEquals("REQUESTED",service.requestReturn(customer,9L,"Lỗi sản phẩm").returnStatus());
        }
    }

    @Test void codStartsPendingWithoutCallingPayos() {
        Product product = new Product(); org.springframework.test.util.ReflectionTestUtils.setField(product,"id",1L); product.setName("Áo"); product.setPrice(BigDecimal.TEN); product.setStock(5); product.setActive(true);
        when(products.findLockedById(1L)).thenReturn(Optional.of(product));
        User customer = new User(); org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        var result = service.create(customer,new OrderService.CheckoutRequest("Địa chỉ", "COD",null,List.of(new OrderService.RequestedItem(1L,1,null,null))));
        assertEquals("PENDING",result.order().status());
        assertEquals("COD",result.order().paymentStatus());
        assertNull(result.paymentUrl()); assertEquals(4,product.getStock());
        verify(carts, never()).deleteByCustomerId(anyLong());
        verify(carts).findByCustomerIdOrderByIdAsc(2L); verifyNoInteractions(payos);
        verify(payments).save(argThat(p -> "PENDING".equals(p.getStatus())));
    }
    @Test void successfulPaymentWaitsForAdminAndLateWebhookDoesNotRegress() throws Exception {
        Order order = new Order(); org.springframework.test.util.ReflectionTestUtils.setField(order,"id",9L); order.setOrderCode(9009L); order.setStatus("PENDING"); order.setPaymentMethod("PAYOS"); order.setPaymentStatus("PENDING"); order.setTotalAmount(BigDecimal.TEN); order.setCustomer(new User());
        Payment payment = new Payment(); payment.setOrder(order);
        when(orders.findIdByOrderCode(9009L)).thenReturn(Optional.of(9L));
        when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        when(payments.findByOrderId(9L)).thenReturn(Optional.of(payment));
        when(payos.verifyWebhook(any(),any())).thenReturn(true);
        var payload = new ObjectMapper().readTree("{\"success\":true,\"data\":{\"orderCode\":9009,\"amount\":10,\"code\":\"00\"}}");
        service.webhook(payload,"signature");
        assertEquals("PENDING",order.getStatus()); assertEquals("PAID",payment.getStatus());
        order.setStatus("CONFIRMED"); service.webhook(payload,"signature");
        assertEquals("CONFIRMED",order.getStatus());
        order.setStatus("CANCELLED"); service.webhook(payload,"signature");
        assertEquals("CANCELLED",order.getStatus());
        verify(orders,times(1)).save(order);
    }
    @Test void payosAlsoStartsPendingAndReturnsPaymentLink() {
        Product product = new Product(); product.setName("Áo"); product.setPrice(BigDecimal.TEN); product.setStock(5); product.setActive(true);
        when(products.findLockedById(1L)).thenReturn(Optional.of(product));
        when(payos.createPaymentLink(any())).thenReturn(new PayosService.Link("link", "https://example.com/payment", "000201"));
        var result = service.create(new User(), new OrderService.CheckoutRequest("Địa chỉ", "PAYOS", null, List.of(new OrderService.RequestedItem(1L,1,null,null))));
        assertEquals("PENDING",result.order().status()); assertEquals("PENDING",result.order().paymentStatus());
        assertEquals("https://example.com/payment",result.paymentUrl()); assertEquals("000201",result.qrCode());
        verify(payments).save(argThat(p -> "000201".equals(p.getQrCode())));
    }
    @Test void webhookNeverChangesProcessingStateIncludingAfterAdminConfirmation() throws Exception {
        for (String current : List.of("PENDING", "CONFIRMED", "SHIPPED")) {
            for (boolean success : List.of(true,false)) {
                reset(orders,payments,events,payos,notifications);
                Order order = paymentOrder(current); Payment payment = new Payment(); payment.setOrder(order);
                when(orders.findIdByOrderCode(9009L)).thenReturn(Optional.of(9L)); when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
                when(payments.findByOrderId(9L)).thenReturn(Optional.of(payment)); when(payos.verifyWebhook(any(),any())).thenReturn(true);
                var payload = new ObjectMapper().readTree("{\"success\":" + success + ",\"data\":{\"orderCode\":9009,\"amount\":10,\"code\":\"" + (success ? "00" : "01") + "\"}}");
                service.webhook(payload,"signature");
                assertEquals(current,order.getStatus()); assertEquals(success ? "PAID" : "CANCELLED",order.getPaymentStatus());
                assertFalse(order.isStockReleased());
                verify(notifications).create(any(), anyString(), argThat(content -> !content.contains("đã được hủy")), anyString(), eq(9L));
            }
        }
    }
    private Order paymentOrder(String status) {
        Order order = new Order(); org.springframework.test.util.ReflectionTestUtils.setField(order,"id",9L);
        order.setOrderCode(9009L); order.setStatus(status); order.setPaymentMethod("PAYOS"); order.setPaymentStatus("PENDING"); order.setTotalAmount(BigDecimal.TEN); order.setCustomer(new User());
        return order;
    }
    @Test void paymentConfirmedDuringCancellationDoesNotLogCustomerCancellation() {
        User customer=new User();org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        Order order=paymentOrder("PENDING");order.setCustomer(customer);
        Payment payment=new Payment();payment.setOrder(order);
        PaymentAttempt attempt=new PaymentAttempt();attempt.setOrder(order);attempt.setProviderOrderCode(9009L);attempt.setPaymentLinkId("paid-link");
        when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        when(payments.findByOrderId(9L)).thenReturn(Optional.of(payment));
        when(attempts.findFirstByOrderIdOrderByIdDesc(9L)).thenReturn(Optional.of(attempt));
        when(payos.getPayment("paid-link")).thenReturn(new PayosService.ProviderPayment(9009L,10L,10L,"PAID","paid-link"));
        assertEquals("PENDING",service.cancel(customer,9L,"Cancel").status());
        assertEquals("PAID",order.getPaymentStatus());verifyNoInteractions(audit,products,vouchers);
        verify(payos,never()).cancelPaymentLink(anyString());
    }
    @Test void expiryOnlyChangesPaymentStateAndIsIdempotent() {
        Order order = paymentOrder("PENDING"); order.setExpiresAt(java.time.Instant.now().minusSeconds(60));
        org.springframework.test.util.ReflectionTestUtils.setField(service,"expiryWorker",new AbandonedOrderWorker(orders,payments,attempts,stock,vouchers,notifications,reconciliation));
        when(orders.expiredPendingIds(eq(0L),any(),any())).thenReturn(List.of(9L)); when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        service.cleanupExpired(); service.cleanupExpired();
        assertEquals("PENDING",order.getStatus()); assertEquals("EXPIRED",order.getPaymentStatus()); assertFalse(order.isStockReleased());
        verify(orders,times(1)).save(order); verifyNoInteractions(products);
    }

    @Test void onlyOwnerCanReopenPendingQrAndCompletedPaymentsHideIt() {
        User customer = new User(); org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        User stranger = new User(); org.springframework.test.util.ReflectionTestUtils.setField(stranger,"id",3L);
        Order order = paymentOrder("PENDING"); order.setCustomer(customer); order.setExpiresAt(java.time.Instant.now().plusSeconds(600));
        Payment payment = new Payment(); payment.setQrCode("000201"); payment.setCheckoutUrl("https://pay.test/link");
        when(orders.findByIdAndCustomerId(9L,2L)).thenReturn(Optional.of(order));
        when(payments.findByOrderId(9L)).thenReturn(Optional.of(payment));
        assertEquals("000201", service.paymentDetails(customer,9L).qrCode());
        assertThrows(ApiException.class, () -> service.paymentDetails(stranger,9L));
        order.setPaymentStatus("PAID");
        assertNull(service.paymentDetails(customer,9L).qrCode());
        assertNull(service.paymentDetails(customer,9L).paymentUrl());
        order.setPaymentStatus("PENDING"); order.setExpiresAt(java.time.Instant.now().minusSeconds(1));
        assertEquals("EXPIRED", service.paymentDetails(customer,9L).paymentStatus());
        assertNull(service.paymentDetails(customer,9L).qrCode());
        order.setStatus("CANCELLED"); order.setPaymentStatus("CANCELLED");
        assertNull(service.paymentDetails(customer,9L).qrCode());
    }

    @Test void retryCreatesNewProviderAttemptForSameOrderWithoutChangingStock() {
        User customer = new User(); org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        Order order = paymentOrder("PENDING"); order.setCustomer(customer); order.setPaymentStatus("EXPIRED");
        Payment payment = new Payment(); payment.setOrder(order); payment.setPaymentLinkId("old-link");
        PaymentAttempt old = new PaymentAttempt(); old.setOrder(order); old.setProviderOrderCode(9009L); old.setPaymentLinkId("old-link"); old.setStatus("EXPIRED");
        when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        when(payments.findByOrderId(9L)).thenReturn(Optional.of(payment));
        when(attempts.findFirstByOrderIdOrderByIdDesc(9L)).thenReturn(Optional.of(old));
        when(payos.getPayment("old-link")).thenReturn(new PayosService.ProviderPayment(9009L,10L,0L,"EXPIRED","old-link"));
        when(payos.createPaymentLink(eq(order),anyLong())).thenReturn(new PayosService.Link("new-link","https://pay.test/new","new-qr"));
        var result = service.retryPayment(customer,9L);
        assertEquals("PENDING",result.paymentStatus()); assertEquals("new-qr",result.qrCode());
        assertEquals("new-link",payment.getPaymentLinkId()); assertEquals(9009L,order.getOrderCode());
        verify(attempts).save(argThat(a -> "new-link".equals(a.getPaymentLinkId()) && a.getProviderOrderCode() != 9009L));
        verifyNoInteractions(products,carts,vouchers);
    }

    @Test void syncMarksPaidOnceAndBlocksAnotherCustomersPayment() {
        User customer = new User(); org.springframework.test.util.ReflectionTestUtils.setField(customer,"id",2L);
        User stranger = new User(); org.springframework.test.util.ReflectionTestUtils.setField(stranger,"id",3L);
        Order order = paymentOrder("PENDING"); order.setCustomer(customer);
        Payment payment = new Payment(); payment.setOrder(order); payment.setPaymentLinkId("link");
        PaymentAttempt attempt = new PaymentAttempt(); attempt.setOrder(order); attempt.setProviderOrderCode(9009L); attempt.setPaymentLinkId("link");
        when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        when(payments.findByOrderId(9L)).thenReturn(Optional.of(payment));
        when(attempts.findFirstByOrderIdOrderByIdDesc(9L)).thenReturn(Optional.of(attempt));
        when(payos.getPayment("link")).thenReturn(new PayosService.ProviderPayment(9009L,10L,10L,"PAID","link"));
        assertThrows(ApiException.class, () -> service.syncPayment(stranger,9L));
        assertEquals("PAID",service.syncPayment(customer,9L).paymentStatus());
        assertEquals("PAID",service.syncPayment(customer,9L).paymentStatus());
        verify(notifications,times(1)).create(eq(customer),anyString(),anyString(),eq("PAYMENT_CONFIRMED"),eq(9L));
    }
}
