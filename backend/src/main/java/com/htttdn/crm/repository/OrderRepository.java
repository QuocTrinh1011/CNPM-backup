package com.htttdn.crm.repository;

import com.htttdn.crm.entity.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface OrderRepository
    extends JpaRepository<Order, Long>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<Order> {
  @Query(
      "select coalesce(sum(o.discountAmount),0) from Order o where"
          + " upper(o.voucherCode)=upper(:code) and o.status<>'CANCELLED'")
  java.math.BigDecimal voucherSavings(
      @org.springframework.data.repository.query.Param("code") String code);

  @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @Query("select o from Order o where o.id=:id")
  Optional<Order> findForStatusUpdate(@Param("id") Long id);

  @Query(
      "select o.id from Order o where o.id>:after and o.paymentMethod='PAYOS' and o.status in"
          + " ('PENDING','PENDING_PAYMENT') and o.paymentStatus in"
          + " ('PENDING','EXPIRED','FAILED','CANCELLED') and o.expiresAt<=:cutoff order by o.id")
  List<Long> abandonedIds(
      @Param("after") Long after, @Param("cutoff") java.time.Instant cutoff, Pageable page);

  @Query(
      "select o.id from Order o where o.id>:after and o.paymentMethod='PAYOS' and"
          + " o.paymentStatus='PENDING' and o.status<>'CANCELLED' and o.expiresAt<:now order by"
          + " o.id")
  List<Long> expiredPendingIds(
      @Param("after") Long after, @Param("now") java.time.Instant now, Pageable page);

  @Query("select o.id from Order o where o.orderCode=:code")
  Optional<Long> findIdByOrderCode(@Param("code") Long code);

  Page<Order> findByStatus(String status, Pageable p);

  long countByStatus(String status);

  Page<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable p);

  Optional<Order> findByIdAndCustomerId(Long id, Long customerId);

  Optional<Order> findByOrderCode(Long orderCode);

  @Query(
      "select case when count(o)>0 then true else false end from Order o join o.items i where"
          + " o.customer.id=:customerId and i.product.id=:productId and o.status in :statuses")
  boolean existsEligiblePurchase(
      @Param("customerId") Long customerId,
      @Param("productId") Long productId,
      @Param("statuses") Collection<String> statuses);

  @Query(
      "select o from Order o where o.paymentMethod='PAYOS' and o.paymentStatus='PENDING' and"
          + " o.status<>'CANCELLED' and o.expiresAt is not null and o.expiresAt<:now")
  List<Order> findExpiredPending(@Param("now") java.time.Instant now);

  @Query("select coalesce(sum(o.totalAmount),0) from Order o where o.status <> 'CANCELLED'")
  java.math.BigDecimal revenue();
}
