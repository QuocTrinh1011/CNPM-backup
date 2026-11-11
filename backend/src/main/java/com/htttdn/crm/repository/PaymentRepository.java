package com.htttdn.crm.repository;

import com.htttdn.crm.entity.Payment;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
  Optional<Payment> findByOrderId(Long orderId);

  Optional<Payment> findByPaymentLinkId(String paymentLinkId);
}
