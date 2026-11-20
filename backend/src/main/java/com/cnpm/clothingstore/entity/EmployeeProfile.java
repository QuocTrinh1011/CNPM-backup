package com.cnpm.clothingstore.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "employee_profiles")
public class EmployeeProfile implements Persistable<Long> {
    @Id
    @Column(name = "employee_id")
    private Long employeeId;

    @Transient
    private boolean newEntity = true;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", insertable = false, updatable = false)
    private User account;

    @Column(name = "employee_code", nullable = false, length = 40, unique = true)
    private String employeeCode;

    @Column(name = "education_level", length = 120)
    private String educationLevel;

    @Column(name = "job_title", nullable = false, length = 150)
    private String jobTitle;

    @Column(name = "permission_profile", nullable = false, length = 20)
    private String permissionProfile = "STAFF";

    @Column(name = "work_area", nullable = false, length = 20)
    private String workArea = "GENERAL";

    @Column(name = "employment_status", nullable = false, length = 20)
    private String employmentStatus = "ACTIVE";

    @Column(name = "hire_date", nullable = false)
    private LocalDate hireDate;

    @Column(name = "resignation_date")
    private LocalDate resignationDate;

    @Column(name = "monthly_base_salary", nullable = false, precision = 15, scale = 2)
    private BigDecimal monthlyBaseSalary = BigDecimal.ZERO;

    @Column(name = "insurance_salary_base", nullable = false, precision = 15, scale = 2)
    private BigDecimal insuranceSalaryBase = BigDecimal.ZERO;

    @Column(name = "reports_to_employee_id")
    private Long reportsToEmployeeId;

    @Column(name = "emergency_contact_name", length = 150)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 40)
    private String emergencyContactPhone;

    @Column(name = "emergency_contact_relationship", length = 80)
    private String emergencyContactRelationship;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Override
    public Long getId() { return employeeId; }
    @Override
    public boolean isNew() { return newEntity; }
    @PostPersist
    @PostLoad
    void markNotNew() { newEntity = false; }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public User getAccount() { return account; }
    public void setAccount(User account) { this.account = account; }
    public String getEmployeeCode() { return employeeCode; }
    public void setEmployeeCode(String employeeCode) { this.employeeCode = employeeCode; }
    public String getEducationLevel() { return educationLevel; }
    public void setEducationLevel(String educationLevel) { this.educationLevel = educationLevel; }
    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }
    public String getPermissionProfile() { return permissionProfile; }
    public void setPermissionProfile(String permissionProfile) { this.permissionProfile = permissionProfile; }
    public String getWorkArea() { return workArea; }
    public void setWorkArea(String workArea) { this.workArea = workArea; }
    public String getEmploymentStatus() { return employmentStatus; }
    public void setEmploymentStatus(String employmentStatus) { this.employmentStatus = employmentStatus; }
    public LocalDate getHireDate() { return hireDate; }
    public void setHireDate(LocalDate hireDate) { this.hireDate = hireDate; }
    public LocalDate getResignationDate() { return resignationDate; }
    public void setResignationDate(LocalDate resignationDate) { this.resignationDate = resignationDate; }
    public BigDecimal getMonthlyBaseSalary() { return monthlyBaseSalary; }
    public void setMonthlyBaseSalary(BigDecimal monthlyBaseSalary) { this.monthlyBaseSalary = monthlyBaseSalary; }
    public BigDecimal getInsuranceSalaryBase() { return insuranceSalaryBase; }
    public void setInsuranceSalaryBase(BigDecimal insuranceSalaryBase) { this.insuranceSalaryBase = insuranceSalaryBase; }
    public Long getReportsToEmployeeId() { return reportsToEmployeeId; }
    public void setReportsToEmployeeId(Long reportsToEmployeeId) { this.reportsToEmployeeId = reportsToEmployeeId; }
    public String getEmergencyContactName() { return emergencyContactName; }
    public void setEmergencyContactName(String emergencyContactName) { this.emergencyContactName = emergencyContactName; }
    public String getEmergencyContactPhone() { return emergencyContactPhone; }
    public void setEmergencyContactPhone(String emergencyContactPhone) { this.emergencyContactPhone = emergencyContactPhone; }
    public String getEmergencyContactRelationship() { return emergencyContactRelationship; }
    public void setEmergencyContactRelationship(String emergencyContactRelationship) { this.emergencyContactRelationship = emergencyContactRelationship; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void touch() { updatedAt = Instant.now(); }
}
