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
@Table(name = "material_issue_request_items")
public class MaterialIssueRequestItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private MaterialIssueRequest request;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_material_id", nullable = false)
    private ProductionPlanMaterial planMaterial;

    @Column(nullable = false, precision = 15, scale = 3)
    private BigDecimal quantity;

    public Long getId() { return id; }
    public MaterialIssueRequest getRequest() { return request; }
    public void setRequest(MaterialIssueRequest request) { this.request = request; }
    public ProductionPlanMaterial getPlanMaterial() { return planMaterial; }
    public void setPlanMaterial(ProductionPlanMaterial planMaterial) { this.planMaterial = planMaterial; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
}
