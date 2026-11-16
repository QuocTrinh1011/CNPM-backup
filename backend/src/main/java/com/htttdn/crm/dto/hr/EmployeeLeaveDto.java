package com.htttdn.crm.dto.hr;

import com.htttdn.crm.entity.EmployeeLeaveRequest;

import java.time.Instant;
import java.time.LocalDate;

public record EmployeeLeaveDto(
        Long id,
        Long employeeId,
        String employeeCode,
        String employeeName,
        String requestType,
        LocalDate startDate,
        LocalDate endDate,
        String employeeNote,
        String status,
        Long reviewerId,
        String reviewerName,
        Instant reviewedAt,
        String reviewerNote,
        Instant createdAt,
        Instant updatedAt
) {
    public static EmployeeLeaveDto from(EmployeeLeaveRequest request) {
        var employee = request.getEmployee();
        var account = employee.getAccount();
        var reviewer = request.getReviewedBy();
        return new EmployeeLeaveDto(request.getId(), employee.getEmployeeId(), employee.getEmployeeCode(),
                account.getFullName(), request.getRequestType(), request.getStartDate(), request.getEndDate(),
                request.getEmployeeNote(), request.getStatus(), reviewer == null ? null : reviewer.getId(),
                reviewer == null ? null : reviewer.getFullName(), request.getReviewedAt(), request.getReviewerNote(),
                request.getCreatedAt(), request.getUpdatedAt());
    }
}
