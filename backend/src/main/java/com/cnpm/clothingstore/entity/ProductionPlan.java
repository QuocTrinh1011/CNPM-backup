package com.cnpm.clothingstore.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "production_plans")
public class ProductionPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plan_code", nullable = false, unique = true, length = 40)
    private String planCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_id", nullable = false)
    private ProductRecipe recipe;

    @Column(name = "target_quantity", nullable = false)
    private int targetQuantity;

    @Column(name = "completed_quantity", nullable = false)
    private int completedQuantity;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assigned_employee_id", nullable = false)
    private EmployeeProfile assignedEmployee;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false, length = 20)
    private String status = "PLANNED";

    @Column(length = 2000)
    private String note;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "closed_at")
    private Instant closedAt;

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ProductionPlanMaterial> materials = new ArrayList<>();

    public Long getId() { return id; }
    public String getPlanCode() { return planCode; }
    public void setPlanCode(String planCode) { this.planCode = planCode; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public ProductRecipe getRecipe() { return recipe; }
    public void setRecipe(ProductRecipe recipe) { this.recipe = recipe; }
    public int getTargetQuantity() { return targetQuantity; }
    public void setTargetQuantity(int targetQuantity) { this.targetQuantity = targetQuantity; }
    public int getCompletedQuantity() { return completedQuantity; }
    public void setCompletedQuantity(int completedQuantity) { this.completedQuantity = completedQuantity; }
    public EmployeeProfile getAssignedEmployee() { return assignedEmployee; }
    public void setAssignedEmployee(EmployeeProfile assignedEmployee) { this.assignedEmployee = assignedEmployee; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
    public List<ProductionPlanMaterial> getMaterials() { return materials; }
    public void addMaterial(ProductionPlanMaterial material) { materials.add(material); material.setPlan(this); }
}
