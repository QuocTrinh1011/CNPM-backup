package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "employee_payroll_periods", uniqueConstraints =
        @UniqueConstraint(name = "uq_employee_payroll_period", columnNames = {"period_year", "period_month"}))
public class EmployeePayrollPeriod {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "period_year", nullable = false) private int periodYear;
    @Column(name = "period_month", nullable = false) private int periodMonth;
    @Column(name = "standard_paid_workdays", nullable = false, precision = 4, scale = 1) private BigDecimal standardPaidWorkdays;
    @Column(nullable = false, length = 20) private String status = "DRAFT";
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by") private User createdBy;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "reviewed_by") private User reviewedBy;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "published_by") private User publishedBy;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Column(name = "reviewed_at") private Instant reviewedAt;
    @Column(name = "published_at") private Instant publishedAt;
    @OneToMany(mappedBy = "period", fetch = FetchType.LAZY) private List<EmployeePayslip> payslips = new ArrayList<>();

    public Long getId() { return id; }
    public int getPeriodYear() { return periodYear; }
    public void setPeriodYear(int value) { periodYear = value; }
    public int getPeriodMonth() { return periodMonth; }
    public void setPeriodMonth(int value) { periodMonth = value; }
    public BigDecimal getStandardPaidWorkdays() { return standardPaidWorkdays; }
    public void setStandardPaidWorkdays(BigDecimal value) { standardPaidWorkdays = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User value) { createdBy = value; }
    public User getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(User value) { reviewedBy = value; }
    public User getPublishedBy() { return publishedBy; }
    public void setPublishedBy(User value) { publishedBy = value; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant value) { reviewedAt = value; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant value) { publishedAt = value; }
    public List<EmployeePayslip> getPayslips() { return payslips; }
}
