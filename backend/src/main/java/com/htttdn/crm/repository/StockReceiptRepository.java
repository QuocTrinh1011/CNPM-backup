package com.htttdn.crm.repository;

import com.htttdn.crm.entity.StockReceipt;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockReceiptRepository extends JpaRepository<StockReceipt, Long> {
  @EntityGraph(attributePaths = "supplier")
  Page<StockReceipt> findAllByOrderByReceivedAtDescIdDesc(Pageable pageable);

  @Query("select count(item) from StockReceiptItem item where item.receipt.id = :receiptId")
  long countItemsByReceiptId(@Param("receiptId") Long receiptId);

  @Override
  @EntityGraph(attributePaths = {"supplier", "items", "items.product"})
  Optional<StockReceipt> findById(Long id);
}
