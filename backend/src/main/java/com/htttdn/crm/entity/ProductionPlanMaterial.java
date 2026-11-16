package com.htttdn.crm.entity;

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
@Table(name = "production_plan_materials")
public class ProductionPlanMaterial {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private ProductionPlan plan;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    private RawMaterial material;

    @Column(name = "material_code", nullable = false, length = 40)
    private String materialCode;

    @Column(name = "material_name", nullable = false, length = 150)
    private String materialName;

    @Column(nullable = false, length = 24)
    private String unit;

    @Column(name = "quantity_per_product", nullable = false, precision = 15, scale = 3)
    private BigDecimal quantityPerProduct;

    @Column(name = "required_quantity", nullable = false, precision = 15, scale = 3)
    private BigDecimal requiredQuantity;

    @Column(name = "allocated_quantity", nullable = false, precision = 15, scale = 3)
    private BigDecimal allocatedQuantity = BigDecimal.ZERO.setScale(3);

    @Column(name = "consumed_quantity", nullable = false, precision = 15, scale = 3)
    private BigDecimal consumedQuantity = BigDecimal.ZERO.setScale(3);

    @Column(name = "returned_quantity", nullable = false, precision = 15, scale = 3)
    private BigDecimal returnedQuantity = BigDecimal.ZERO.setScale(3);

    public Long getId() { return id; }
    public ProductionPlan getPlan() { return plan; }
    public void setPlan(ProductionPlan plan) { this.plan = plan; }
    public RawMaterial getMaterial() { return material; }
    public void setMaterial(RawMaterial material) { this.material = material; }
    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
    public String getMaterialName() { return materialName; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getQuantityPerProduct() { return quantityPerProduct; }
    public void setQuantityPerProduct(BigDecimal quantityPerProduct) { this.quantityPerProduct = quantityPerProduct; }
    public BigDecimal getRequiredQuantity() { return requiredQuantity; }
    public void setRequiredQuantity(BigDecimal requiredQuantity) { this.requiredQuantity = requiredQuantity; }
    public BigDecimal getAllocatedQuantity() { return allocatedQuantity; }
    public void setAllocatedQuantity(BigDecimal allocatedQuantity) { this.allocatedQuantity = allocatedQuantity; }
    public BigDecimal getConsumedQuantity() { return consumedQuantity; }
    public void setConsumedQuantity(BigDecimal consumedQuantity) { this.consumedQuantity = consumedQuantity; }
    public BigDecimal getReturnedQuantity() { return returnedQuantity; }
    public void setReturnedQuantity(BigDecimal returnedQuantity) { this.returnedQuantity = returnedQuantity; }
}
