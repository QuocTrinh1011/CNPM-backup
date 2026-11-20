package com.cnpm.clothingstore.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "material_return_items")
public class MaterialReturnItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "return_id", nullable = false)
    private MaterialReturn materialReturn;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_material_id", nullable = false)
    private ProductionPlanMaterial planMaterial;

    @Column(nullable = false, precision = 15, scale = 3)
    private BigDecimal quantity;

    public Long getId() { return id; }
    public MaterialReturn getMaterialReturn() { return materialReturn; }
    public void setMaterialReturn(MaterialReturn materialReturn) { this.materialReturn = materialReturn; }
    public ProductionPlanMaterial getPlanMaterial() { return planMaterial; }
    public void setPlanMaterial(ProductionPlanMaterial planMaterial) { this.planMaterial = planMaterial; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
}
