package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.WarehouseFinishedStock;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WarehouseFinishedStockRepository extends JpaRepository<WarehouseFinishedStock, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select stock from WarehouseFinishedStock stock where stock.product.id = :productId")
    Optional<WarehouseFinishedStock> findByProductIdForUpdate(@Param("productId") Long productId);
}
