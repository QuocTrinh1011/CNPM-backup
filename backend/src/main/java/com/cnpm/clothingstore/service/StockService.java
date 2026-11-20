package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.Order;
import com.cnpm.clothingstore.entity.Product;
import com.cnpm.clothingstore.entity.InventoryItemType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.ProductRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Map;
import java.util.TreeMap;
import java.util.Optional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

@Service
public class StockService {
    private final ProductRepository products;
    private final EntityManager em;
    private final InventoryMovementService movements;
    public StockService(ProductRepository products, EntityManager em, InventoryMovementService movements) {
        this.products = products;
        this.em = em;
        this.movements = movements;
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
        AuditTrail.Actor actor = AuditTrail.actor();
        if (actor == null) actor = new AuditTrail.Actor(null, "Order expiry worker", "SYSTEM");
        release(order, actor);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void release(Order order, AuditTrail.Actor actor) {
        if (order.isStockReleased()) return;
        Map<Long, Integer> quantities = new TreeMap<>();
        order.getItems().forEach(item -> quantities.merge(item.getProduct().getId(), item.getQuantity(), Math::addExact));
        quantities.forEach((id, quantity) -> {
            Product product = lockProduct(id).orElseThrow(() -> new ApiException(
                HttpStatus.CONFLICT, "STOCK_RELEASE_FAILED", "Không tìm thấy sản phẩm để hoàn kho. Vui lòng kiểm tra đơn hàng."));
            product.setStock(Math.addExact(product.getStock(), quantity));
            product.setUpdatedAt(Instant.now());
            products.save(product);
            movements.recordChangeAs(actor, InventoryItemType.PRODUCT, id, InventoryLocation.SELLABLE, null,
                    java.math.BigDecimal.valueOf(quantity).setScale(3),
                    java.math.BigDecimal.valueOf(product.getStock()).setScale(3),
                    InventoryMovementType.SALE_RELEASE, "ORDER_STOCK_RELEASE", order.getId());
        });
        order.setStockReleased(true);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordSaleReservation(Order order, AuditTrail.Actor actor) {
        Map<Long, Integer> quantities = new TreeMap<>();
        Map<Long, Product> productsById = new TreeMap<>();
        order.getItems().forEach(item -> {
            long productId = item.getProduct().getId();
            quantities.merge(productId, item.getQuantity(), Math::addExact);
            productsById.putIfAbsent(productId, item.getProduct());
        });
        quantities.forEach((productId, quantity) -> {
            Product product = productsById.get(productId);
            movements.recordChangeAs(actor, InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, null,
                    java.math.BigDecimal.valueOf(quantity).negate().setScale(3),
                    java.math.BigDecimal.valueOf(product.getStock()).setScale(3),
                    InventoryMovementType.SALE_RESERVATION, "ORDER_CHECKOUT", order.getId());
        });
    }
}
