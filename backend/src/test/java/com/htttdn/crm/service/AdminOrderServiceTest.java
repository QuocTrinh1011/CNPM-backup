package com.htttdn.crm.service;

import com.htttdn.crm.dto.admin.AdminDtos.StatusRequest;
import com.htttdn.crm.entity.Order;
import com.htttdn.crm.entity.Payment;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.OrderRepository;
import com.htttdn.crm.repository.PaymentRepository;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminOrderServiceTest {
    @Test void shippedOrdersCannotBeCancelledAndStockIsNotTouched() {
        for(String state : new String[]{"SHIPPED","DELIVERING"}) {
            order(state);
            assertThrows(ApiException.class,()->service.updateStatus(9L,new StatusRequest("CANCELLED","Test")));
        }
        verifyNoInteractions(stock,notifications);
    }
    @Test void adminCannotCompleteCancelDeliveredOrSkipShipping() {
        for (String[] pair : new String[][]{{"DELIVERED","COMPLETED"},{"DELIVERED","CANCELLED"},{"CONFIRMED","DELIVERED"},{"PREPARING","DELIVERED"},{"COMPLETED","COMPLETED"}}) {
            Order order = order(pair[0]);
            assertThrows(ApiException.class, () -> service.updateStatus(9L,new StatusRequest(pair[1],"Lý do")));
            assertEquals(pair[0],order.getStatus());
        }
        Order shipped = order("SHIPPED");
        service.updateStatus(9L,new StatusRequest("DELIVERED",null));
        assertEquals("DELIVERED",shipped.getStatus());
    }
    final OrderRepository orders = mock(OrderRepository.class);
    final NotificationService notifications = mock(NotificationService.class);
    final PaymentRepository payments = mock(PaymentRepository.class);
    final StockService stock = mock(StockService.class);
    final AdminOrderService service = new AdminOrderService(orders, notifications, mock(VoucherService.class), payments, stock);

    Order order(String status) {
        Order order = new Order(); order.setOrderCode(9009L); order.setCustomer(new User()); order.setStatus(status);
        when(orders.findForStatusUpdate(9L)).thenReturn(Optional.of(order));
        when(orders.save(order)).thenReturn(order);
        return order;
    }

    @Test void rejectsMissingBlankAndLongReasonsWithoutMutation() {
        for (String reason : new String[]{null, "  ", "x".repeat(1001)}) {
            ApiException e = assertThrows(ApiException.class, () -> service.updateStatus(9L, new StatusRequest("CANCELLED", reason)));
            assertEquals(400, e.status().value());
        }
        verifyNoInteractions(orders, notifications);
    }

    @Test void cancellingPersistsTrimmedReasonAndNotifiesOwnerOnce() {
        Order order = order("CONFIRMED");
        service.updateStatus(9L, new StatusRequest("CANCELLED", "  Hết hàng  "));
        service.updateStatus(9L, new StatusRequest("CANCELLED", "Hết hàng"));
        assertEquals("CANCELLED", order.getStatus()); assertEquals("Hết hàng", order.getCancelReason());
        verify(notifications, times(1)).create(order.getCustomer(), "Đơn hàng đã bị hủy", "Đơn hàng #9009 đã bị hủy. Lý do: Hết hàng", "ORDER_CANCELLED", order.getId());
        verify(orders, times(1)).save(order);
        verify(stock,times(1)).release(order);
    }

    @Test void cancellingUnpaidPayosStopsPaymentWithoutChangingAlreadyPaidOrders() {
        Order pending = order("PENDING"); pending.setPaymentMethod("PAYOS"); pending.setPaymentStatus("PENDING");
        Payment payment = new Payment(); when(payments.findByOrderId(pending.getId())).thenReturn(Optional.of(payment));
        service.updateStatus(9L, new StatusRequest("CANCELLED", "Hết hàng"));
        assertEquals("CANCELLED", pending.getPaymentStatus()); assertEquals("CANCELLED", payment.getStatus());
        verify(payments).save(payment);
        reset(payments);
        Order paid = order("PENDING"); paid.setPaymentMethod("PAYOS"); paid.setPaymentStatus("PAID");
        service.updateStatus(9L, new StatusRequest("CANCELLED", "Hết hàng"));
        assertEquals("PAID", paid.getPaymentStatus()); verifyNoInteractions(payments);
    }

    @Test void supplementsLegacyOrderAndRejectsOverwrite() {
        Order order = order("CANCELLED");
        service.updateStatus(9L, new StatusRequest("CANCELLED", "Không giao được"));
        ApiException e = assertThrows(ApiException.class, () -> service.updateStatus(9L, new StatusRequest("CANCELLED", "Lý do khác")));
        assertEquals(409, e.status().value()); assertEquals("Không giao được", order.getCancelReason());
        verify(notifications, times(1)).create(any(), anyString(), anyString(), eq("ORDER_CANCELLED"), isNull());
    }

    @Test void otherStatusesDoNotRequireReasonAndNotifyCustomer() {
        Order order = order("CONFIRMED");
        service.updateStatus(9L, new StatusRequest("SHIPPED", null));
        assertEquals("SHIPPED", order.getStatus()); verify(notifications).create(any(),anyString(),contains("Đang giao"),eq("ORDER_STATUS"),isNull());
    }
    @Test void rejectsBackwardAndTerminalTransitionsWithoutSideEffects() {
        for (String[] pair : new String[][]{{"CANCELLED","CONFIRMED"},{"CANCELLED","PENDING_PAYMENT"},{"COMPLETED","SHIPPED"},{"COMPLETED","CANCELLED"},{"SHIPPED","CONFIRMED"},{"DELIVERED","SHIPPED"},{"CONFIRMED","PENDING_PAYMENT"}}) {
            reset(orders, notifications);
            Order order = order(pair[0]);
            ApiException error = assertThrows(ApiException.class, () -> service.updateStatus(9L, new StatusRequest(pair[1], "Lý do thử")));
            assertEquals(409, error.status().value());
            assertEquals(pair[0], order.getStatus());
            verify(orders, never()).save(any()); verifyNoInteractions(notifications);
        }
    }
    @Test void advancesLegacyPendingAndTreatsRepeatedStatusAsNoOp() {
        Order order = order("PENDING");
        service.updateStatus(9L, new StatusRequest("CONFIRMED", null));
        service.updateStatus(9L, new StatusRequest("CONFIRMED", null));
        assertEquals("CONFIRMED", order.getStatus());
        verify(orders, times(1)).save(order); verify(notifications,times(1)).create(any(),anyString(),anyString(),eq("ORDER_STATUS"),isNull());
    }
    @Test void cannotSkipConfirmationOrConfirmUnpaidOrder() {
        for (String[] pair : new String[][]{{"PENDING","SHIPPED"},{"PENDING","COMPLETED"},{"PENDING_PAYMENT","CONFIRMED"},{"PENDING_PAYMENT","PENDING"}}) {
            reset(orders, notifications); Order order = order(pair[0]);
            assertThrows(ApiException.class, () -> service.updateStatus(9L,new StatusRequest(pair[1], null)));
            assertEquals(pair[0],order.getStatus()); verify(orders,never()).save(any());
        }
    }
}
