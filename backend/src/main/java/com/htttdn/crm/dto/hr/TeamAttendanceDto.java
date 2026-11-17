package com.htttdn.crm.dto.hr;

import com.htttdn.crm.entity.EmployeeAttendance;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TeamAttendanceDto(
        Long employeeId,
        String employeeCode,
        String employeeName,
        LocalDate attendanceDate,
        String attendanceStatus,
        BigDecimal dayFraction
) {
    public static TeamAttendanceDto from(EmployeeAttendance attendance) {
        var employee = attendance.getEmployee();
        return new TeamAttendanceDto(employee.getEmployeeId(), employee.getEmployeeCode(),
                employee.getAccount().getFullName(), attendance.getAttendanceDate(),
                attendance.getAttendanceStatus(), attendance.getDayFraction());
    }
}
