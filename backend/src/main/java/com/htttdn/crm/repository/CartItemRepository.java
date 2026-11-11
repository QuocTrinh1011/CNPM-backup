package com.htttdn.crm.repository;

import com.htttdn.crm.entity.CartItem;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
  List<CartItem> findByCustomerIdOrderByIdAsc(Long customerId);

  Optional<CartItem> findByCustomerIdAndProductIdAndSizeAndColor(
      Long customerId, Long productId, String size, String color);

  void deleteByCustomerId(Long customerId);
}
