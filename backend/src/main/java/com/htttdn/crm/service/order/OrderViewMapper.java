package com.htttdn.crm.service.order;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.*;
import org.springframework.data.domain.*;

import java.math.*;
import java.time.*;
import java.util.*;
import com.htttdn.crm.service.*;
import com.htttdn.crm.service.OrderService.*;

public final class OrderViewMapper {
    public static OrderView view(Order o) { List<OrderLineView> lines = o.getItems().stream().map(i -> new OrderLineView(i.getProduct().getId(), i.getProduct().getName(), i.getProduct().getImageUrl(), i.getQuantity(), i.getUnitPrice(), i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())), i.getSize(), i.getColor())).toList(); return new OrderView(o.getId(), o.getOrderCode(), o.getStatus(), o.getPaymentStatus(), o.getPaymentMethod(), o.getDeliveryAddress(), o.getTrackingCode(), o.getCancelReason(), o.getReturnStatus(), o.getReturnReason(), o.getVoucherCode(), o.getDiscountAmount(), o.getShippingFee(), o.getTotalAmount(), o.getCreatedAt(), o.getUpdatedAt(), lines, o.getReturnRequestedAt(), o.getReturnHistory().stream().map(e->new ReturnEventView(e.getStatus(),e.getNote(),e.getCreatedAt())).toList()); }

    public static PaymentView paymentView(Order order, Payment payment) {
        boolean expired = order.getExpiresAt() != null && !order.getExpiresAt().isAfter(Instant.now());
        boolean available = "PENDING".equals(order.getPaymentStatus()) && !"CANCELLED".equals(order.getStatus()) && !expired && !order.paymentReviewRequired;
        String status = "CANCELLED".equals(order.getStatus()) && "PENDING".equals(order.getPaymentStatus()) ? "CANCELLED" :
            expired && "PENDING".equals(order.getPaymentStatus()) ? "EXPIRED" : order.getPaymentStatus();
        return new PaymentView(order.getId(), order.getOrderCode(), status, order.getTotalAmount(), order.getExpiresAt(),
            available ? payment.getQrCode() : null, available ? payment.getCheckoutUrl() : null,
            !order.paymentReviewRequired && !"PAID".equals(order.getPaymentStatus()) && !Set.of("CANCELLED", "SHIPPED", "DELIVERING", "DELIVERED", "COMPLETED").contains(order.getStatus()),order.paymentReviewRequired);
    }
}
