package com.cnpm.clothingstore.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "inventory_movements")
public class InventoryMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 12)
    private InventoryItemType itemType;

    @Column(name = "item_id", nullable = false)
    private Long itemId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private InventoryLocation location;

    @Column(name = "scope_id")
    private Long scopeId;

    @Column(name = "quantity_delta", nullable = false, precision = 15, scale = 3)
    private BigDecimal quantityDelta;

    @Column(name = "quantity_after", nullable = false, precision = 15, scale = 3)
    private BigDecimal quantityAfter;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, length = 32)
    private InventoryMovementType movementType;

    @Column(name = "reference_type", nullable = false, length = 40)
    private String referenceType;

    @Column(name = "reference_id", nullable = false)
    private Long referenceId;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", nullable = false, length = 150)
    private String actorName;

    @Column(name = "actor_role", nullable = false, length = 20)
    private String actorRole;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public InventoryItemType getItemType() { return itemType; }
    public void setItemType(InventoryItemType itemType) { this.itemType = itemType; }
    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }
    public InventoryLocation getLocation() { return location; }
    public void setLocation(InventoryLocation location) { this.location = location; }
    public Long getScopeId() { return scopeId; }
    public void setScopeId(Long scopeId) { this.scopeId = scopeId; }
    public BigDecimal getQuantityDelta() { return quantityDelta; }
    public void setQuantityDelta(BigDecimal quantityDelta) { this.quantityDelta = quantityDelta; }
    public BigDecimal getQuantityAfter() { return quantityAfter; }
    public void setQuantityAfter(BigDecimal quantityAfter) { this.quantityAfter = quantityAfter; }
    public InventoryMovementType getMovementType() { return movementType; }
    public void setMovementType(InventoryMovementType movementType) { this.movementType = movementType; }
    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }
    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }
    public Long getActorId() { return actorId; }
    public void setActorId(Long actorId) { this.actorId = actorId; }
    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }
    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
