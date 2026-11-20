package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.Payment; import org.springframework.data.jpa.repository.*; import java.util.*;

public interface PaymentRepository extends JpaRepository<Payment,Long> { Optional<Payment> findByOrderId(Long orderId); Optional<Payment> findByPaymentLinkId(String paymentLinkId); }
