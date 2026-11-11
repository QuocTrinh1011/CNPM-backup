package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PaymentWebhookEvent;
import org.springframework.data.jpa.repository.*;

public interface PaymentWebhookEventRepository extends JpaRepository<PaymentWebhookEvent, Long> {
  boolean existsByEventKey(String eventKey);
}
