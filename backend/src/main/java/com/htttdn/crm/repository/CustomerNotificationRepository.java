package com.htttdn.crm.repository;

import com.htttdn.crm.entity.CustomerNotification;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface CustomerNotificationRepository extends JpaRepository<CustomerNotification, Long> {
  List<CustomerNotification> findTop50ByCustomerIdOrderByCreatedAtDesc(Long customerId);

  Optional<CustomerNotification> findByIdAndCustomerId(Long id, Long customerId);

  long countByCustomerIdAndReadAtIsNull(Long customerId);
}
