package com.htttdn.crm.repository;

import com.htttdn.crm.entity.*;
import java.util.*;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.*;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {
  boolean existsByOrderIdAndProductId(Long orderId, Long productId);

  boolean existsByOrderId(Long orderId);

  List<Feedback> findByOrderId(Long orderId);

  Page<Feedback> findByDeletedAtIsNull(org.springframework.data.domain.Pageable p);

  Page<Feedback> findByStatusAndDeletedAtIsNull(
      String status, org.springframework.data.domain.Pageable p);

  List<Feedback> findByProductIdAndHiddenFalseAndDeletedAtIsNullOrderByCreatedAtDesc(
      Long productId);

  Optional<Feedback> findByCustomerIdAndProductId(Long c, Long p);

  @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @Query("select f from Feedback f where f.id=:id")
  Optional<Feedback> findForModeration(
      @org.springframework.data.repository.query.Param("id") Long id);
}
