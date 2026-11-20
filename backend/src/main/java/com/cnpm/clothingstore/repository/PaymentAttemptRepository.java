package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.PaymentAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, Long> {
    java.util.List<PaymentAttempt> findByOrderIdOrderByIdAsc(Long orderId);
    Optional<PaymentAttempt> findByProviderOrderCode(Long providerOrderCode);
    Optional<PaymentAttempt> findFirstByOrderIdOrderByIdDesc(Long orderId);
    boolean existsByProviderOrderCode(Long providerOrderCode);
}
