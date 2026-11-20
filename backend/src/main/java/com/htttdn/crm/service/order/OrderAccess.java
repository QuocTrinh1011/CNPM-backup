package com.htttdn.crm.service.order;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;

import java.math.*;
import java.time.*;
import java.util.*;
import com.htttdn.crm.service.*;
import com.htttdn.crm.service.OrderService.*;

public final class OrderAccess {
    private final OrderRepository orders;
    public OrderAccess(OrderRepository orders) {
        this.orders = orders;
    }

    public Order owned(User customer, Long id) { return orders.findByIdAndCustomerId(id, customer.getId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.")); }

    public Order lockedOwned(User customer, Long id) {
        return orders.findForStatusUpdate(id).filter(order -> Objects.equals(order.getCustomer().getId(), customer.getId()))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng."));
    }
}
