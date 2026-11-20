package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.CustomerNotification; import org.springframework.data.jpa.repository.*; import java.util.*;
public interface CustomerNotificationRepository extends JpaRepository<CustomerNotification,Long> { List<CustomerNotification> findTop50ByCustomerIdOrderByCreatedAtDesc(Long customerId); Optional<CustomerNotification> findByIdAndCustomerId(Long id,Long customerId); long countByCustomerIdAndReadAtIsNull(Long customerId); }
