package com.htttdn.crm.service.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.htttdn.crm.dto.hr.PayrollDtos.*;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;
import com.htttdn.crm.service.PayrollCalculator;
import com.htttdn.crm.service.payroll.PayrollRulesParser.ConfiguredRules;
import static com.htttdn.crm.service.payroll.PayrollJsonNumbers.*;
import static com.htttdn.crm.service.payroll.PayrollAdjustments.*;

public final class PayrollInputAssembler {
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    public static PayrollCalculator.Input payrollInput(EmployeeProfile employee, YearMonth month, BigDecimal standardDays,
                                                  int dependents, ConfiguredRules rules, List<EmployeeAttendance> rows,
                                                  List<EmployeeLeaveRequest> approvedLeaves) {
        BigDecimal paid = ZERO, normal = ZERO, rest = ZERO, holiday = ZERO, night = ZERO;
        BigDecimal nightNormal = ZERO, nightNormalAfterDaytimeOvertime = ZERO, nightRest = ZERO, nightHoliday = ZERO;
        Set<LocalDate> recordedDates = new HashSet<>();
        for (EmployeeAttendance row : rows) {
            if (!inEmployment(employee, row.getAttendanceDate())) continue;
            String attendanceStatus = row.getAttendanceStatus().trim().toUpperCase(Locale.ROOT);
            if (("UNPAID_LEAVE".equals(attendanceStatus) || "ABSENT".equals(attendanceStatus))
                    && row.getPaidEquivalentDays().signum() > 0) {
                throw bad("INVALID_PAYROLL_ATTENDANCE", "Ngày nghỉ không lương hoặc vắng mặt không được tính vào ngày công hưởng lương.");
            }
            if (!"WORKED".equals(attendanceStatus)
                    && (row.getOvertimeNormalHours().signum() > 0 || row.getOvertimeRestDayHours().signum() > 0
                    || row.getOvertimeHolidayHours().signum() > 0 || row.getOvertimeNightHours().signum() > 0
                    || row.getOvertimeNightNormalHours().signum() > 0 || row.getOvertimeNightRestDayHours().signum() > 0
                    || row.getOvertimeNightHolidayHours().signum() > 0)) {
                throw bad("OVERTIME_REQUIRES_WORKED_ATTENDANCE", "Giờ tăng ca chỉ hợp lệ trên ngày có trạng thái WORKED.");
            }
            recordedDates.add(row.getAttendanceDate());
            paid = paid.add(row.getPaidEquivalentDays()); normal = normal.add(row.getOvertimeNormalHours());
            rest = rest.add(row.getOvertimeRestDayHours()); holiday = holiday.add(row.getOvertimeHolidayHours());
            night = night.add(row.getOvertimeNightHours());
            nightNormal = nightNormal.add(row.getOvertimeNightNormalHours());
            nightRest = nightRest.add(row.getOvertimeNightRestDayHours());
            nightHoliday = nightHoliday.add(row.getOvertimeNightHolidayHours());
            if (row.getOvertimeNormalHours().signum() > 0) {
                nightNormalAfterDaytimeOvertime = nightNormalAfterDaytimeOvertime.add(row.getOvertimeNightNormalHours());
            }
        }
        Map<LocalDate, String> approved = new HashMap<>();
        for (EmployeeLeaveRequest request : approvedLeaves) {
            if (request.getEmployee().getEmployeeId().equals(employee.getEmployeeId())) {
                for (LocalDate date = request.getStartDate().isBefore(month.atDay(1)) ? month.atDay(1) : request.getStartDate();
                     !date.isAfter(request.getEndDate().isAfter(month.atEndOfMonth()) ? month.atEndOfMonth() : request.getEndDate()); date = date.plusDays(1)) {
                    approved.put(date, request.getRequestType());
                }
            }
        }
        for (LocalDate date = month.atDay(1); !date.isAfter(month.atEndOfMonth()); date = date.plusDays(1)) {
            if (!inEmployment(employee, date) || !rules.workingWeekdays().contains(date.getDayOfWeek().getValue()) || recordedDates.contains(date)) continue;
            if (rules.publicHolidays().contains(date) || "ANNUAL".equals(approved.get(date))) paid = paid.add(BigDecimal.ONE);
        }
        if (paid.compareTo(standardDays) > 0) throw bad("PAYROLL_DAYS_EXCEED_STANDARD", "Ngày công tính lương vượt số ngày công chuẩn của " + employee.getEmployeeCode() + ".");
        return new PayrollCalculator.Input(employee.getMonthlyBaseSalary(), employee.getInsuranceSalaryBase(), standardDays,
                paid, normal, rest, holiday, night, nightNormal, nightNormalAfterDaytimeOvertime,
                nightRest, nightHoliday, dependents, List.of());
    }

    public static boolean inEmployment(EmployeeProfile employee, LocalDate date) {
        return !date.isBefore(employee.getHireDate()) && (employee.getResignationDate() == null || !date.isAfter(employee.getResignationDate()));
    }

    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
