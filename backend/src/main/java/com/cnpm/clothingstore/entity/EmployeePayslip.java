package com.cnpm.clothingstore.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "employee_payslips", indexes = {
        @Index(name = "idx_employee_payslip_period_status", columnList = "payroll_period_id,status,employee_id")})
public class EmployeePayslip {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "payroll_period_id", nullable = false) private EmployeePayrollPeriod period;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "employee_id", nullable = false) private EmployeeProfile employee;
    @Column(nullable = false) private int revision = 1;
    @Column(nullable = false, length = 20) private String status = "DRAFT";
    @Column(name = "contracted_monthly_salary", nullable = false, precision = 15, scale = 2) private BigDecimal contractedMonthlySalary;
    @Column(name = "insurance_salary_base", nullable = false, precision = 15, scale = 2) private BigDecimal insuranceSalaryBase;
    @Column(name = "paid_equivalent_days", nullable = false, precision = 4, scale = 1) private BigDecimal paidEquivalentDays;
    @Column(name = "gross_earnings", nullable = false, precision = 15, scale = 2) private BigDecimal grossEarnings;
    @Column(name = "separate_benefits", nullable = false, precision = 15, scale = 2) private BigDecimal separateBenefits;
    @Column(name = "employee_deductions", nullable = false, precision = 15, scale = 2) private BigDecimal employeeDeductions;
    @Column(name = "employer_contributions", nullable = false, precision = 15, scale = 2) private BigDecimal employerContributions;
    @Column(name = "take_home_pay", nullable = false, precision = 15, scale = 2) private BigDecimal takeHomePay;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "source_snapshot", nullable = false, columnDefinition = "jsonb") private JsonNode sourceSnapshot;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "replaces_payslip_id") private EmployeePayslip replacesPayslip;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Column(name = "published_at") private Instant publishedAt;
    @OneToMany(mappedBy = "payslip", fetch = FetchType.LAZY) @OrderBy("displayOrder,id") private List<EmployeePayrollLine> lines = new ArrayList<>();

    public Long getId() { return id; }
    public EmployeePayrollPeriod getPeriod() { return period; }
    public void setPeriod(EmployeePayrollPeriod value) { period = value; }
    public EmployeeProfile getEmployee() { return employee; }
    public void setEmployee(EmployeeProfile value) { employee = value; }
    public int getRevision() { return revision; }
    public void setRevision(int value) { revision = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public BigDecimal getContractedMonthlySalary() { return contractedMonthlySalary; }
    public void setContractedMonthlySalary(BigDecimal value) { contractedMonthlySalary = value; }
    public BigDecimal getInsuranceSalaryBase() { return insuranceSalaryBase; }
    public void setInsuranceSalaryBase(BigDecimal value) { insuranceSalaryBase = value; }
    public BigDecimal getPaidEquivalentDays() { return paidEquivalentDays; }
    public void setPaidEquivalentDays(BigDecimal value) { paidEquivalentDays = value; }
    public BigDecimal getGrossEarnings() { return grossEarnings; }
    public void setGrossEarnings(BigDecimal value) { grossEarnings = value; }
    public BigDecimal getSeparateBenefits() { return separateBenefits; }
    public void setSeparateBenefits(BigDecimal value) { separateBenefits = value; }
    public BigDecimal getEmployeeDeductions() { return employeeDeductions; }
    public void setEmployeeDeductions(BigDecimal value) { employeeDeductions = value; }
    public BigDecimal getEmployerContributions() { return employerContributions; }
    public void setEmployerContributions(BigDecimal value) { employerContributions = value; }
    public BigDecimal getTakeHomePay() { return takeHomePay; }
    public void setTakeHomePay(BigDecimal value) { takeHomePay = value; }
    public JsonNode getSourceSnapshot() { return sourceSnapshot; }
    public void setSourceSnapshot(JsonNode value) { sourceSnapshot = value; }
    public EmployeePayslip getReplacesPayslip() { return replacesPayslip; }
    public void setReplacesPayslip(EmployeePayslip value) { replacesPayslip = value; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant value) { publishedAt = value; }
    public List<EmployeePayrollLine> getLines() { return lines; }
}
