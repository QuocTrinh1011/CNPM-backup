package com.htttdn.crm.dto.hr;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AttendanceUpsertRequest(
        @NotNull Long employeeId,
        @NotNull LocalDate attendanceDate,
        @NotBlank @Size(max = 24) String attendanceStatus,
        @NotNull BigDecimal dayFraction,
        @NotNull BigDecimal paidEquivalentDays,
        @NotNull @DecimalMin("0.00") BigDecimal overtimeNormalHours,
        @NotNull @DecimalMin("0.00") BigDecimal overtimeRestDayHours,
        @NotNull @DecimalMin("0.00") BigDecimal overtimeHolidayHours,
        @NotNull @DecimalMin("0.00") BigDecimal overtimeNightHours,
        @DecimalMin("0.00") BigDecimal overtimeNightNormalHours,
        @DecimalMin("0.00") BigDecimal overtimeNightRestDayHours,
        @DecimalMin("0.00") BigDecimal overtimeNightHolidayHours,
        @Size(max = 2000) String note
) {}
