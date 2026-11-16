package com.htttdn.crm.service;

import com.htttdn.crm.entity.InventoryItemType;
import com.htttdn.crm.entity.InventoryLocation;
import com.htttdn.crm.entity.InventoryMovement;
import com.htttdn.crm.entity.InventoryMovementType;
import com.htttdn.crm.repository.InventoryMovementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.math.BigDecimal;
import java.time.Instant;

@Service
public class InventoryMovementService {
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999999.999");
    private final InventoryMovementRepository movements;

    public InventoryMovementService(InventoryMovementRepository movements) {
        this.movements = movements;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public InventoryMovement recordChange(InventoryItemType itemType, long itemId,
                                          InventoryLocation location, Long scopeId,
                                          BigDecimal delta, BigDecimal balanceAfter,
                                          InventoryMovementType movementType,
                                          String referenceType, long referenceId) {
        return recordChangeAs(AuditTrail.actor(), itemType, itemId, location, scopeId, delta, balanceAfter,
                movementType, referenceType, referenceId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public InventoryMovement recordChangeAs(AuditTrail.Actor actor, InventoryItemType itemType, long itemId,
                                            InventoryLocation location, Long scopeId,
                                            BigDecimal delta, BigDecimal balanceAfter,
                                            InventoryMovementType movementType,
                                            String referenceType, long referenceId) {
        requireTransaction();
        validate(itemType, itemId, location, scopeId, delta, balanceAfter, movementType, referenceType, referenceId);
        BigDecimal normalizedDelta = delta.setScale(3, java.math.RoundingMode.UNNECESSARY);
        BigDecimal normalizedBalance = balanceAfter.setScale(3, java.math.RoundingMode.UNNECESSARY);
        if (normalizedDelta.precision() > 15 || normalizedBalance.precision() > 15) {
            throw new IllegalArgumentException("Inventory movement quantity exceeds NUMERIC(15,3)");
        }
        if (actor == null || actor.name() == null || actor.name().isBlank()
                || actor.role() == null || actor.role().isBlank()) {
            throw new IllegalStateException("Verified actor required for inventory movement");
        }

        InventoryMovement movement = new InventoryMovement();
        movement.setItemType(itemType);
        movement.setItemId(itemId);
        movement.setLocation(location);
        movement.setScopeId(scopeId);
        movement.setQuantityDelta(normalizedDelta);
        movement.setQuantityAfter(normalizedBalance);
        movement.setMovementType(movementType);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setActorId(actor.id());
        movement.setActorName(actor.name());
        movement.setActorRole(actor.role());
        movement.setCreatedAt(Instant.now());
        return movements.save(movement);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordTransfer(InventoryItemType itemType, long itemId,
                               InventoryLocation from, Long fromScope, BigDecimal fromAfter,
                               InventoryLocation to, Long toScope, BigDecimal toAfter,
                               BigDecimal quantity, InventoryMovementType movementType,
                               String referenceType, long referenceId) {
        requireTransaction();
        requireQuantity(quantity, "Transfer quantity must be positive with at most three fractional digits");
        if (quantity.signum() <= 0 || from == to && java.util.Objects.equals(fromScope, toScope)) {
            throw new IllegalArgumentException("Inventory transfer must move a positive quantity between distinct locations");
        }
        recordChange(itemType, itemId, from, fromScope, quantity.negate(), fromAfter,
                movementType, referenceType, referenceId);
        recordChange(itemType, itemId, to, toScope, quantity, toAfter,
                movementType, referenceType, referenceId);
    }

    private static void validate(InventoryItemType itemType, long itemId, InventoryLocation location,
                                 Long scopeId, BigDecimal delta, BigDecimal balanceAfter,
                                 InventoryMovementType movementType, String referenceType, long referenceId) {
        if (itemType == null || itemId < 1 || location == null || movementType == null
                || referenceId < 1 || referenceType == null || referenceType.isBlank()
                || referenceType.length() > 40 || !referenceType.matches("[A-Z0-9_]+")) {
            throw new IllegalArgumentException("Invalid inventory movement identity or reference");
        }
        if (delta == null || delta.scale() > 3 || delta.precision() > 15 || delta.abs().compareTo(MAX_QUANTITY) > 0
                || balanceAfter == null || balanceAfter.scale() > 3 || balanceAfter.precision() > 15
                || balanceAfter.compareTo(MAX_QUANTITY) > 0
                || balanceAfter.signum() < 0 || delta.signum() == 0 && movementType != InventoryMovementType.OPENING) {
            throw new IllegalArgumentException("Invalid inventory movement quantity or resulting balance");
        }
        boolean materialLocation = location == InventoryLocation.RAW_MATERIAL_AVAILABLE
                || location == InventoryLocation.PRODUCTION_ALLOCATED;
        if (materialLocation != (itemType == InventoryItemType.MATERIAL)
                || (location == InventoryLocation.PRODUCTION_ALLOCATED) != (scopeId != null)
                || scopeId != null && scopeId < 1) {
            throw new IllegalArgumentException("Inventory item, location, and scope do not match");
        }
        if (movementType == InventoryMovementType.RAW_MATERIAL_RECEIPT
                && location != InventoryLocation.RAW_MATERIAL_AVAILABLE) {
            throw new IllegalArgumentException("Raw material receipts must increase available stock");
        }
    }

    private static void requireQuantity(BigDecimal quantity, String message) {
        if (quantity == null || quantity.scale() > 3 || quantity.precision() > 15) {
            throw new IllegalArgumentException(message);
        }
    }

    private static void requireTransaction() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Inventory movements must be recorded inside the stock transaction");
        }
    }
}
