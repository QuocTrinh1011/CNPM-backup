package com.cnpm.clothingstore.dto.hr;

import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmployeeProfileDto(
        Long id,
        String fullName,
        String email,
        String phone,
        boolean locked,
        String employeeCode,
        String educationLevel,
        String jobTitle,
        String permissionProfile,
        String workArea,
        String employmentStatus,
        LocalDate hireDate,
        LocalDate resignationDate,
        BigDecimal monthlyBaseSalary,
        BigDecimal insuranceSalaryBase,
        Long reportsToEmployeeId,
        String emergencyContactName,
        String emergencyContactPhone,
        String emergencyContactRelationship
) {
    public static EmployeeProfileDto from(EmployeeProfile profile) {
        User account = profile.getAccount();
        return new EmployeeProfileDto(
                profile.getEmployeeId(), account.getFullName(), account.getEmail(), account.getPhone(), account.isLocked(),
                profile.getEmployeeCode(), profile.getEducationLevel(), profile.getJobTitle(),
                profile.getPermissionProfile(), profile.getWorkArea(), profile.getEmploymentStatus(), profile.getHireDate(),
                profile.getResignationDate(), profile.getMonthlyBaseSalary(), profile.getInsuranceSalaryBase(),
                profile.getReportsToEmployeeId(), profile.getEmergencyContactName(), profile.getEmergencyContactPhone(),
                profile.getEmergencyContactRelationship());
    }
}
