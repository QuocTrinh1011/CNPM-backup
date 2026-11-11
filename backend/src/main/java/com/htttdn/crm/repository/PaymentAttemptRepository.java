package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PaymentAttempt;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, Long> {
  java.util.List<PaymentAttempt> findByOrderIdOrderByIdAsc(Long orderId);

  Optional<PaymentAttempt> findByProviderOrderCode(Long providerOrderCode);

  Optional<PaymentAttempt> findFirstByOrderIdOrderByIdDesc(Long orderId);

  boolean existsByProviderOrderCode(Long providerOrderCode);
}
