package com.htttdn.crm.dto.hr;

import com.htttdn.crm.entity.EmployeeAttendance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record EmployeeAttendanceDto(
        Long id,
        Long employeeId,
        String employeeCode,
        String employeeName,
        LocalDate attendanceDate,
        String attendanceStatus,
        BigDecimal dayFraction,
        BigDecimal paidEquivalentDays,
        BigDecimal overtimeNormalHours,
        BigDecimal overtimeRestDayHours,
        BigDecimal overtimeHolidayHours,
        BigDecimal overtimeNightHours,
        String note,
        Long recordedById,
        String recordedByName,
        Instant createdAt,
        Instant updatedAt
) {
    public static EmployeeAttendanceDto from(EmployeeAttendance attendance) {
        var employee = attendance.getEmployee();
        var account = employee.getAccount();
        var recorder = attendance.getRecordedBy();
        return new EmployeeAttendanceDto(attendance.getId(), employee.getEmployeeId(), employee.getEmployeeCode(),
                account.getFullName(), attendance.getAttendanceDate(), attendance.getAttendanceStatus(),
                attendance.getDayFraction(), attendance.getPaidEquivalentDays(), attendance.getOvertimeNormalHours(),
                attendance.getOvertimeRestDayHours(), attendance.getOvertimeHolidayHours(), attendance.getOvertimeNightHours(),
                attendance.getNote(), recorder == null ? null : recorder.getId(), recorder == null ? null : recorder.getFullName(),
                attendance.getCreatedAt(), attendance.getUpdatedAt());
    }
}
