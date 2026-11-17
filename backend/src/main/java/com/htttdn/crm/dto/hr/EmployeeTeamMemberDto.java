package com.htttdn.crm.dto.hr;

import com.htttdn.crm.entity.EmployeeProfile;

import java.time.LocalDate;

public record EmployeeTeamMemberDto(
        Long employeeId,
        String employeeCode,
        String fullName,
        String jobTitle,
        String employmentStatus,
        LocalDate hireDate
) {
    public static EmployeeTeamMemberDto from(EmployeeProfile profile) {
        return new EmployeeTeamMemberDto(profile.getEmployeeId(), profile.getEmployeeCode(),
                profile.getAccount().getFullName(), profile.getJobTitle(), profile.getEmploymentStatus(), profile.getHireDate());
    }
}
