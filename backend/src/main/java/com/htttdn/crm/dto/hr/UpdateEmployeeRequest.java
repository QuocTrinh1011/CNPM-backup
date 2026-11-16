package com.htttdn.crm.dto.hr;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdateEmployeeRequest(
        @Size(max = 150) String fullName,
        @Email @Size(max = 255) String email,
        @Size(max = 40) String phone,
        @Size(max = 40) String employeeCode,
        @Size(max = 120) String educationLevel,
        @Size(max = 150) String jobTitle,
        String permissionProfile,
        @Pattern(regexp = "(?i)^(GENERAL|SALES|WAREHOUSE)$") String workArea,
        String employmentStatus,
        LocalDate hireDate,
        LocalDate resignationDate,
        @DecimalMin("0.00") BigDecimal monthlyBaseSalary,
        @DecimalMin("0.00") BigDecimal insuranceSalaryBase,
        Long reportsToEmployeeId,
        @Size(max = 150) String emergencyContactName,
        @Size(max = 40) String emergencyContactPhone,
        @Size(max = 80) String emergencyContactRelationship
) {}
