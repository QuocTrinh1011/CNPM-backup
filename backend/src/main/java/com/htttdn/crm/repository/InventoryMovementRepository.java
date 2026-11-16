package com.htttdn.crm.repository;

import com.htttdn.crm.entity.InventoryMovement;
import com.htttdn.crm.entity.InventoryMovementType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    long countByMovementTypeAndReferenceTypeAndReferenceId(
            InventoryMovementType movementType, String referenceType, Long referenceId);

    List<InventoryMovement> findAllByMovementTypeAndReferenceTypeAndReferenceId(
            InventoryMovementType movementType, String referenceType, Long referenceId);

    boolean existsByItemTypeAndItemId(com.htttdn.crm.entity.InventoryItemType itemType, Long itemId);
}
