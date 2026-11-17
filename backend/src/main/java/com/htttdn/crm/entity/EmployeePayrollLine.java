package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "employee_payroll_lines", indexes =
        @Index(name = "idx_employee_payroll_lines_payslip", columnList = "payslip_id,display_order,id"))
public class EmployeePayrollLine {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "payslip_id", nullable = false) private EmployeePayslip payslip;
    @Column(name = "line_type", nullable = false, length = 20) private String lineType;
    @Column(nullable = false, length = 60) private String code;
    @Column(nullable = false, length = 500) private String description;
    @Column(precision = 12, scale = 3) private BigDecimal quantity;
    @Column(precision = 15, scale = 4) private BigDecimal rate;
    @Column(nullable = false, precision = 15, scale = 2) private BigDecimal amount;
    @Column(name = "display_order", nullable = false) private int displayOrder;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
    public Long getId() { return id; }
    public EmployeePayslip getPayslip() { return payslip; }
    public void setPayslip(EmployeePayslip value) { payslip = value; }
    public String getLineType() { return lineType; }
    public void setLineType(String value) { lineType = value; }
    public String getCode() { return code; }
    public void setCode(String value) { code = value; }
    public String getDescription() { return description; }
    public void setDescription(String value) { description = value; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal value) { quantity = value; }
    public BigDecimal getRate() { return rate; }
    public void setRate(BigDecimal value) { rate = value; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal value) { amount = value; }
    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int value) { displayOrder = value; }
    public Instant getCreatedAt() { return createdAt; }
}
