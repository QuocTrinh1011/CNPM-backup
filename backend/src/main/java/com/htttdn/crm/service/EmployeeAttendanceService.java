package com.htttdn.crm.service;

import com.htttdn.crm.dto.hr.AttendanceUpsertRequest;
import com.htttdn.crm.dto.hr.EmployeeAttendanceDto;
import com.htttdn.crm.dto.hr.EmployeeTeamMemberDto;
import com.htttdn.crm.dto.hr.TeamAttendanceDto;
import com.htttdn.crm.entity.EmployeeAttendance;
import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.EmployeeAttendanceRepository;
import com.htttdn.crm.repository.EmployeeProfileRepository;
import com.htttdn.crm.repository.UserRepository;
import com.htttdn.crm.security.JwtTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class EmployeeAttendanceService {
    private static final Set<String> STATUSES = Set.of(
            "WORKED", "PAID_LEAVE", "SICK_LEAVE", "MATERNITY_LEAVE", "UNPAID_LEAVE", "PUBLIC_HOLIDAY", "ABSENT");
    private static final Set<BigDecimal> DAY_FRACTIONS = Set.of(BigDecimal.ZERO, new BigDecimal("0.5"), BigDecimal.ONE);

    private final EmployeeAttendanceRepository attendance;
    private final EmployeeProfileRepository profiles;
    private final UserRepository users;
    private final EmployeeAccessService employeeAccess;
    private final JwtTokenService jwt;
    private final AuditTrail audit;

    public EmployeeAttendanceService(EmployeeAttendanceRepository attendance, EmployeeProfileRepository profiles,
                                    UserRepository users, EmployeeAccessService employeeAccess,
                                    JwtTokenService jwt, AuditTrail audit) {
        this.attendance = attendance;
        this.profiles = profiles;
        this.users = users;
        this.employeeAccess = employeeAccess;
        this.jwt = jwt;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<EmployeeAttendanceDto> hrMonth(String authorization, Long employeeId, int year, int month) {
        requireHr(authorization);
        YearMonth period = period(year, month);
        return attendance.findMonth(period.atDay(1), period.atEndOfMonth(), employeeId)
                .stream().map(EmployeeAttendanceDto::from).toList();
    }

    @Transactional
    public EmployeeAttendanceDto upsert(String authorization, AttendanceUpsertRequest input) {
        User recorder = requireHr(authorization);
        validate(input);
        EmployeeProfile employee = profiles.findById(input.employeeId())
                .filter(profile -> "EMPLOYEE".equals(profile.getAccount().getRole()))
                .orElseThrow(() -> notFound("Không tìm thấy hồ sơ nhân viên."));

        EmployeeAttendance row = attendance.findByEmployee_EmployeeIdAndAttendanceDate(employee.getEmployeeId(), input.attendanceDate())
                .orElseGet(EmployeeAttendance::new);
        boolean creating = row.getId() == null;
        Map<String, Object> before = creating ? Map.of() : snapshot(row);
        row.setEmployee(employee);
        row.setAttendanceDate(input.attendanceDate());
        row.setAttendanceStatus(normalize(input.attendanceStatus()));
        row.setDayFraction(input.dayFraction());
        row.setPaidEquivalentDays(input.paidEquivalentDays());
        row.setOvertimeNormalHours(input.overtimeNormalHours());
        row.setOvertimeRestDayHours(input.overtimeRestDayHours());
        row.setOvertimeHolidayHours(input.overtimeHolidayHours());
        row.setOvertimeNightHours(input.overtimeNightHours());
        row.setNote(normalizeNullable(input.note()));
        row.setRecordedBy(recorder);
        attendance.saveAndFlush(row);
        audit.record(creating ? "CREATE" : "UPDATE", "EMPLOYEE_ATTENDANCE", row.getId(), before, snapshot(row));
        return EmployeeAttendanceDto.from(row);
    }

    @Transactional(readOnly = true)
    public List<EmployeeAttendanceDto> mine(String authorization, int year, int month) {
        EmployeeProfile employee = employeeAccess.requireEmployee(authorization);
        YearMonth period = period(year, month);
        return attendance.findMonth(period.atDay(1), period.atEndOfMonth(), employee.getEmployeeId())
                .stream().map(EmployeeAttendanceDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<EmployeeTeamMemberDto> team(String authorization) {
        EmployeeProfile lead = requireTeamLead(authorization);
        return profiles.findActiveDirectReports(lead.getEmployeeId()).stream().map(EmployeeTeamMemberDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TeamAttendanceDto> teamMonth(String authorization, int year, int month) {
        EmployeeProfile lead = requireTeamLead(authorization);
        YearMonth period = period(year, month);
        List<Long> employeeIds = profiles.findActiveDirectReports(lead.getEmployeeId()).stream()
                .map(EmployeeProfile::getEmployeeId).toList();
        if (employeeIds.isEmpty()) return List.of();
        return attendance.findMonthForEmployees(period.atDay(1), period.atEndOfMonth(), employeeIds)
                .stream().map(TeamAttendanceDto::from).toList();
    }

    private User requireHr(String authorization) {
        JwtTokenService.Claims claims = jwt.parse(authorization);
        User user = users.findById(claims.userId()).orElseThrow(() -> notFound("Không tìm thấy tài khoản nhân sự."));
        if (!"MANAGER_HR".equals(claims.role()) || !"MANAGER_HR".equals(user.getRole())
                || user.isLocked() || user.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HR_ROLE_REQUIRED", "Chỉ nhân sự được quản lý chấm công.");
        }
        return user;
    }

    private EmployeeProfile requireTeamLead(String authorization) {
        EmployeeProfile profile = employeeAccess.requireEmployee(authorization);
        if (!"TEAM_LEAD".equals(profile.getPermissionProfile()) || !"ACTIVE".equals(profile.getEmploymentStatus())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TEAM_LEAD_REQUIRED", "Chỉ trưởng nhóm được xem nhân viên thuộc nhóm.");
        }
        return profile;
    }

    private static void validate(AttendanceUpsertRequest input) {
        String status = normalize(input.attendanceStatus());
        if (!STATUSES.contains(status)) throw bad("INVALID_ATTENDANCE_STATUS", "Trạng thái chấm công không hợp lệ.");
        if (!isAllowedDay(input.dayFraction()) || !isAllowedDay(input.paidEquivalentDays())) {
            throw bad("INVALID_ATTENDANCE_DAYS", "Ngày công chỉ được là 0, 0.5 hoặc 1.");
        }
        if (input.paidEquivalentDays().compareTo(input.dayFraction()) > 0) {
            throw bad("INVALID_PAID_DAYS", "Ngày công được tính lương không được vượt quá ngày công ghi nhận.");
        }
        if (input.overtimeNormalHours().signum() < 0 || input.overtimeRestDayHours().signum() < 0
                || input.overtimeHolidayHours().signum() < 0 || input.overtimeNightHours().signum() < 0) {
            throw bad("INVALID_OVERTIME", "Giờ tăng ca không được âm.");
        }
    }

    private static boolean isAllowedDay(BigDecimal value) {
        return value != null && DAY_FRACTIONS.stream().anyMatch(day -> day.compareTo(value) == 0);
    }

    private static YearMonth period(int year, int month) {
        if (year < 2000 || year > 2100 || month < 1 || month > 12) {
            throw bad("INVALID_ATTENDANCE_PERIOD", "Tháng hoặc năm chấm công không hợp lệ.");
        }
        return YearMonth.of(year, month);
    }

    private static Map<String, Object> snapshot(EmployeeAttendance row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("employeeId", row.getEmployee().getEmployeeId());
        result.put("attendanceDate", row.getAttendanceDate());
        result.put("attendanceStatus", row.getAttendanceStatus());
        result.put("dayFraction", row.getDayFraction());
        result.put("paidEquivalentDays", row.getPaidEquivalentDays());
        result.put("overtimeNormalHours", row.getOvertimeNormalHours());
        result.put("overtimeRestDayHours", row.getOvertimeRestDayHours());
        result.put("overtimeHolidayHours", row.getOvertimeHolidayHours());
        result.put("overtimeNightHours", row.getOvertimeNightHours());
        return result;
    }

    private static String normalize(String value) { return value == null ? "" : value.trim().toUpperCase(Locale.ROOT); }
    private static String normalizeNullable(String value) { if (value == null) return null; String result = value.trim(); return result.isEmpty() ? null : result; }
    private static ApiException notFound(String message) { return new ApiException(HttpStatus.NOT_FOUND, "EMPLOYEE_NOT_FOUND", message); }
    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
