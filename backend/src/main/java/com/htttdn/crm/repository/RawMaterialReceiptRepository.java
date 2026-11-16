package com.htttdn.crm.repository;

import com.htttdn.crm.entity.RawMaterialReceipt;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RawMaterialReceiptRepository extends JpaRepository<RawMaterialReceipt, Long> {
    @EntityGraph(attributePaths = "supplier")
    Page<RawMaterialReceipt> findAllByOrderByReceivedAtDescIdDesc(Pageable pageable);

    @Query("select count(item) from RawMaterialReceiptItem item where item.receipt.id = :receiptId")
    long countItemsByReceiptId(@Param("receiptId") Long receiptId);

    @Override
    @EntityGraph(attributePaths = {"supplier", "items", "items.material"})
    Optional<RawMaterialReceipt> findById(Long id);
}
