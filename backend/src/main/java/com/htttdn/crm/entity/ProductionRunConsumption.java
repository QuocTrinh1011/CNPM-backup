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
@Table(name = "production_run_consumptions")
public class ProductionRunConsumption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private ProductionRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_material_id", nullable = false)
    private ProductionPlanMaterial planMaterial;

    @Column(name = "material_code", nullable = false, length = 40)
    private String materialCode;

    @Column(name = "material_name", nullable = false, length = 150)
    private String materialName;

    @Column(nullable = false, length = 24)
    private String unit;

    @Column(nullable = false, precision = 15, scale = 3)
    private BigDecimal quantity;

    public Long getId() { return id; }
    public ProductionRun getRun() { return run; }
    public void setRun(ProductionRun run) { this.run = run; }
    public ProductionPlanMaterial getPlanMaterial() { return planMaterial; }
    public void setPlanMaterial(ProductionPlanMaterial planMaterial) { this.planMaterial = planMaterial; }
    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
    public String getMaterialName() { return materialName; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
}
