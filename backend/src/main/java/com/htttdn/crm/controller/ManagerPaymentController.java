package com.htttdn.crm.controller;

import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.OrderRepository;
import com.htttdn.crm.service.ManagerOrderQuery;
import com.htttdn.crm.service.PaymentCollectionService;
import com.htttdn.crm.service.PaymentReconciliationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager")
public class ManagerPaymentController {
    private final PaymentCollectionService collections;
    private final ManagerOrderQuery query;
    private final OrderRepository orders;
    private final PaymentReconciliationService reconciliation;

    public ManagerPaymentController(PaymentCollectionService collections, ManagerOrderQuery query,
                                    OrderRepository orders, PaymentReconciliationService reconciliation) {
        this.collections = collections;
        this.query = query;
        this.orders = orders;
        this.reconciliation = reconciliation;
    }

    public record Note(@Size(max = 1000) String note) {}

    @PatchMapping("/orders/{id}/cod-collection")
    public ManagerOrderQuery.View cod(@PathVariable Long id, @Valid @RequestBody Note input) {
        collections.confirmCod(id, input == null ? null : input.note());
        return query.detail(id);
    }

    @PostMapping("/orders/{id}/payment/reconcile")
    @Transactional
    public ManagerOrderQuery.View reconcile(@PathVariable Long id) {
        var order = orders.findForStatusUpdate(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng."));
        if (!"PAYOS".equals(order.getPaymentMethod()))
            throw new ApiException(HttpStatus.CONFLICT, "PAYOS_REQUIRED", "Đơn không dùng PayOS.");
        reconciliation.reconcile(order, false);
        orders.saveAndFlush(order);
        return query.detail(id);
    }
}
