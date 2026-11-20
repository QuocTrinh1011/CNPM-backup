package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.InventoryMovement;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    long countByMovementTypeAndReferenceTypeAndReferenceId(
            InventoryMovementType movementType, String referenceType, Long referenceId);

    List<InventoryMovement> findAllByMovementTypeAndReferenceTypeAndReferenceId(
            InventoryMovementType movementType, String referenceType, Long referenceId);

    boolean existsByItemTypeAndItemId(com.cnpm.clothingstore.entity.InventoryItemType itemType, Long itemId);

    List<InventoryMovement> findAllByItemTypeAndItemIdAndLocationAndScopeIdOrderByIdAsc(
            com.cnpm.clothingstore.entity.InventoryItemType itemType, Long itemId, InventoryLocation location, Long scopeId);
}
