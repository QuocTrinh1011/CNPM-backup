package com.htttdn.crm.service;

import com.htttdn.crm.entity.Order;
import com.htttdn.crm.entity.Product;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.ProductRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StockService {
  private final ProductRepository products;
  private final EntityManager em;

  public StockService(ProductRepository products, EntityManager em) {
    this.products = products;
    this.em = em;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public Optional<Product> lockProduct(Long id) {
    var product = products.findLockedById(id);
    // Orders/carts may have loaded this product before waiting for its lock.
    // Refresh after the lock so a managed stale stock value cannot overwrite a committed update.
    product.ifPresent(p -> em.refresh(p, LockModeType.PESSIMISTIC_WRITE));
    return product;
  }

  // Caller holds the order write lock until the enclosing transaction commits.
  @Transactional(propagation = Propagation.MANDATORY)
  public void release(Order order) {
    if (order.isStockReleased()) return;
    Map<Long, Integer> quantities = new TreeMap<>();
    order
        .getItems()
        .forEach(
            item ->
                quantities.merge(item.getProduct().getId(), item.getQuantity(), Math::addExact));
    quantities.forEach(
        (id, quantity) -> {
          Product product =
              lockProduct(id)
                  .orElseThrow(
                      () ->
                          new ApiException(
                              HttpStatus.CONFLICT,
                              "STOCK_RELEASE_FAILED",
                              "Không tìm thấy sản phẩm để hoàn kho. Vui lòng kiểm tra đơn hàng."));
          product.setStock(Math.addExact(product.getStock(), quantity));
          product.setUpdatedAt(Instant.now());
          products.save(product);
        });
    order.setStockReleased(true);
  }
}
