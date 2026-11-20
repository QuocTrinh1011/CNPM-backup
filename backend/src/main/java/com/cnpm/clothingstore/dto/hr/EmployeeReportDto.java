package com.cnpm.clothingstore.dto.hr;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record EmployeeReportDto(int year, int month, LocalDate reportDate,
                                Summary summary,
                                List<EmployeeStatus> employees,
                                List<EducationGroup> educationSummary,
                                SalarySummary salarySummary,
                                TenureSummary tenureSummary) {
    public record Summary(int totalEmployees, int activeCount, int onApprovedLeaveCount,
                          int resignedInPeriodCount, int terminatedInPeriodCount) {}
    public record EmployeeStatus(Long employeeId, String employeeCode, String fullName, String jobTitle,
                                 String educationLevel, String employmentStatus, boolean onApprovedLeave,
                                 List<String> approvedLeaveTypes, LocalDate hireDate, LocalDate separationDate,
                                 boolean resignedInPeriod, long tenureMonths, BigDecimal monthlyBaseSalary,
                                 BigDecimal insuranceSalaryBase, String salaryBasis) {}
    public record EducationGroup(String educationLevel, int employeeCount) {}
    public record SalarySummary(BigDecimal totalMonthlyBaseSalary, BigDecimal averageMonthlyBaseSalary,
                               BigDecimal minimumMonthlyBaseSalary, BigDecimal maximumMonthlyBaseSalary,
                               int employeeCount, String basis) {}
    public record TenureSummary(BigDecimal averageTenureMonths, long maximumTenureMonths, int employeeCount) {}
}
