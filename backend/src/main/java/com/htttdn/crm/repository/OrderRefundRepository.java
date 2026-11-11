package com.htttdn.crm.repository;

import com.htttdn.crm.entity.OrderRefund;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface OrderRefundRepository
    extends JpaRepository<OrderRefund, Long>, JpaSpecificationExecutor<OrderRefund> {
  @EntityGraph(attributePaths = {"order", "order.customer"})
  org.springframework.data.domain.Page<OrderRefund> findAll(
      org.springframework.data.jpa.domain.Specification<OrderRefund> spec,
      org.springframework.data.domain.Pageable page);

  Optional<OrderRefund> findByOrderIdAndRequestKey(Long orderId, String requestKey);

  List<OrderRefund> findByOrderIdOrderByIdDesc(Long orderId);

  @Query("select r.order.id from OrderRefund r where r.id=:id")
  Optional<Long> orderId(@Param("id") Long id);

  @Query(
      "select coalesce(sum(r.amount),0) from OrderRefund r where r.order.id=:id and"
          + " r.status=:status")
  BigDecimal total(@Param("id") Long id, @Param("status") String status);
}
