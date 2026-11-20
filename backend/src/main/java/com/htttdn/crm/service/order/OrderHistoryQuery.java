package com.htttdn.crm.service.order;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;

import java.math.*;
import java.time.*;
import java.util.*;
import com.htttdn.crm.service.*;
import com.htttdn.crm.service.OrderService.*;

public final class OrderHistoryQuery {
    private final OrderRepository orders;
    public OrderHistoryQuery(OrderRepository orders) {
        this.orders = orders;
    }

    public Page<OrderView> history(User customer, int page, int size, String requestedTab, String requestedKeyword) {
        if (page < 0 || size < 1 || size > 50)
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Tham số phân trang không hợp lệ.");
        String tab = requestedTab == null || requestedTab.isBlank() ? "ALL" : requestedTab.trim().toUpperCase(Locale.ROOT);
        Set<String> tabs = Set.of("ALL", "TO_PAY", "TO_CONFIRM", "TO_SHIP", "TO_RECEIVE", "TO_CONFIRM_RECEIPT", "COMPLETED", "CANCELLED", "RETURN");
        if (!tabs.contains(tab)) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Bộ lọc đơn hàng không hợp lệ.");
        String keyword = requestedKeyword == null ? "" : requestedKeyword.trim().toLowerCase(Locale.ROOT);
        if (keyword.length() > 120) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Từ khóa tìm kiếm tối đa 120 ký tự.");

        Specification<Order> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("customer").get("id"), customer.getId()));
            var cancelled = cb.equal(root.get("status"), "CANCELLED");
            var hasReturn = cb.notEqual(cb.coalesce(root.<String>get("returnStatus"), "NONE"), "NONE");
            var unpaidPayos = cb.and(cb.equal(cb.coalesce(root.<String>get("paymentMethod"), "COD"), "PAYOS"),
                cb.notEqual(cb.coalesce(root.<String>get("paymentStatus"), "PENDING"), "PAID"));
            var payableStatus = root.get("status").in("PENDING", "PENDING_PAYMENT", "CONFIRMED", "PREPARING");
            if (!"ALL".equals(tab) && !"CANCELLED".equals(tab)) predicates.add(cb.not(cancelled));
            if (!Set.of("ALL", "CANCELLED", "RETURN").contains(tab)) predicates.add(cb.not(hasReturn));
            switch (tab) {
                case "TO_PAY" -> predicates.add(cb.and(unpaidPayos, payableStatus));
                case "TO_CONFIRM" -> {
                    predicates.add(cb.and(root.get("status").in("PENDING", "PENDING_PAYMENT"), cb.not(unpaidPayos)));
                }
                case "TO_SHIP" -> predicates.add(cb.and(root.get("status").in("CONFIRMED", "PREPARING"), cb.not(unpaidPayos)));
                case "TO_RECEIVE" -> predicates.add(root.get("status").in("SHIPPED", "DELIVERING"));
                case "TO_CONFIRM_RECEIPT" -> predicates.add(cb.equal(root.get("status"), "DELIVERED"));
                case "COMPLETED" -> predicates.add(cb.and(cb.equal(root.get("status"), "COMPLETED"),
                    cb.or(cb.isNull(root.get("returnStatus")), cb.equal(root.get("returnStatus"), "NONE"))));
                case "CANCELLED" -> predicates.add(cb.equal(root.get("status"), "CANCELLED"));
                case "RETURN" -> predicates.add(hasReturn);
                default -> { }
            }
            if (!keyword.isBlank()) {
                String pattern = "%" + keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                var itemQuery = query.subquery(Long.class);
                var item = itemQuery.from(OrderItem.class);
                itemQuery.select(item.get("order").get("id")).where(
                    cb.equal(item.get("order").get("id"), root.get("id")),
                    cb.like(cb.lower(item.get("product").get("name")), pattern, '\\'));
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("orderCode").as(String.class)), pattern, '\\'),
                    cb.exists(itemQuery)));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return orders.findAll(spec, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"))).map(OrderViewMapper::view);
    }
}
