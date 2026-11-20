package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.PaymentWebhookEvent; import org.springframework.data.jpa.repository.*;

public interface PaymentWebhookEventRepository extends JpaRepository<PaymentWebhookEvent,Long> { boolean existsByEventKey(String eventKey); }
