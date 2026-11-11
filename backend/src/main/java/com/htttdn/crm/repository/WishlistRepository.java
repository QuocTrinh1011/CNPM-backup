package com.htttdn.crm.repository;

import com.htttdn.crm.entity.WishlistItem;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface WishlistRepository extends JpaRepository<WishlistItem, Long> {
  List<WishlistItem> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

  Optional<WishlistItem> findByCustomerIdAndProductId(Long customerId, Long productId);

  boolean existsByCustomerIdAndProductId(Long customerId, Long productId);
}
