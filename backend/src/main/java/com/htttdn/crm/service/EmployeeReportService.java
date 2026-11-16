package com.htttdn.crm.service;

import com.htttdn.crm.dto.hr.EmployeeReportDto;
import com.htttdn.crm.dto.hr.EmployeeReportDto.*;
import com.htttdn.crm.entity.EmployeeLeaveRequest;
import com.htttdn.crm.entity.EmployeePayrollPeriod;
import com.htttdn.crm.entity.EmployeePayslip;
import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.EmployeeLeaveRequestRepository;
import com.htttdn.crm.repository.EmployeePayslipRepository;
import com.htttdn.crm.repository.EmployeePayrollPeriodRepository;
import com.htttdn.crm.repository.EmployeeProfileRepository;
import com.htttdn.crm.repository.UserRepository;
import com.htttdn.crm.security.JwtTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EmployeeReportService {
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private final EmployeeProfileRepository profiles;
    private final EmployeeLeaveRequestRepository leaves;
    private final EmployeePayrollPeriodRepository periods;
    private final EmployeePayslipRepository payslips;
    private final UserRepository users;
    private final JwtTokenService jwt;

    public EmployeeReportService(EmployeeProfileRepository profiles, EmployeeLeaveRequestRepository leaves,
                                 EmployeePayrollPeriodRepository periods, EmployeePayslipRepository payslips,
                                 UserRepository users, JwtTokenService jwt) {
        this.profiles = profiles; this.leaves = leaves; this.periods = periods; this.payslips = payslips;
        this.users = users; this.jwt = jwt;
    }

    @Transactional(readOnly = true)
    public EmployeeReportDto monthly(String authorization, int year, int month) {
        requireHr(authorization);
        if (year < 2000 || year > 2100 || month < 1 || month > 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REPORT_PERIOD", "Tháng hoặc năm báo cáo không hợp lệ.");
        }
        YearMonth selected = YearMonth.of(year, month);
        LocalDate start = selected.atDay(1), end = selected.atEndOfMonth();
        List<EmployeeProfile> workforce = profiles.findForWorkforceReport(start, end);
        Map<Long, List<EmployeeLeaveRequest>> approvedLeaveByEmployee = leaves.findApprovedOverlapping(start, end).stream()
                .filter(request -> !"RESIGNATION".equals(request.getRequestType()))
                .collect(Collectors.groupingBy(request -> request.getEmployee().getEmployeeId()));
        Map<Long, EmployeePayslip> publishedSalary = publishedSlips(year, month);

        List<EmployeeStatus> rows = workforce.stream().map(profile -> row(profile, end,
                approvedLeaveByEmployee.getOrDefault(profile.getEmployeeId(), List.of()), publishedSalary.get(profile.getEmployeeId()))).toList();
        int active = (int) rows.stream().filter(row -> "ACTIVE".equals(row.employmentStatus())).count();
        int onLeave = (int) rows.stream().filter(EmployeeStatus::onApprovedLeave).count();
        int resigned = (int) rows.stream().filter(EmployeeStatus::resignedInPeriod).count();
        int terminated = (int) rows.stream().filter(row -> "TERMINATED".equals(row.employmentStatus())
                && row.separationDate() != null && !row.separationDate().isBefore(start) && !row.separationDate().isAfter(end)).count();

        Map<String, Long> educationCounts = rows.stream().collect(Collectors.groupingBy(
                row -> normalizeEducation(row.educationLevel()), TreeMap::new, Collectors.counting()));
        List<EducationGroup> education = educationCounts.entrySet().stream()
                .map(entry -> new EducationGroup(entry.getKey(), entry.getValue().intValue())).toList();
        BigDecimal totalSalary = rows.stream().map(EmployeeStatus::monthlyBaseSalary).reduce(ZERO, BigDecimal::add);
        BigDecimal averageSalary = average(totalSalary, rows.size());
        BigDecimal minSalary = rows.stream().map(EmployeeStatus::monthlyBaseSalary).min(BigDecimal::compareTo).orElse(ZERO);
        BigDecimal maxSalary = rows.stream().map(EmployeeStatus::monthlyBaseSalary).max(BigDecimal::compareTo).orElse(ZERO);
        Set<String> bases = rows.stream().map(EmployeeStatus::salaryBasis).collect(Collectors.toSet());
        String salaryBasis = bases.isEmpty() ? "CURRENT_PROFILE" : bases.size() == 1 ? bases.iterator().next() : "MIXED";
        BigDecimal totalTenure = rows.stream().map(row -> BigDecimal.valueOf(row.tenureMonths())).reduce(ZERO, BigDecimal::add);
        BigDecimal averageTenure = average(totalTenure, rows.size());
        long maxTenure = rows.stream().mapToLong(EmployeeStatus::tenureMonths).max().orElse(0);

        return new EmployeeReportDto(year, month, end,
                new Summary(rows.size(), active, onLeave, resigned, terminated), rows, education,
                new SalarySummary(totalSalary, averageSalary, minSalary, maxSalary, rows.size(), salaryBasis),
                new TenureSummary(averageTenure, maxTenure, rows.size()));
    }

    private Map<Long, EmployeePayslip> publishedSlips(int year, int month) {
        Optional<EmployeePayrollPeriod> period = periods.findByPeriodYearAndPeriodMonth(year, month);
        if (period.isEmpty() || !"PUBLISHED".equals(period.get().getStatus())) return Map.of();
        Map<Long, EmployeePayslip> result = new HashMap<>();
        payslips.findAllForPeriod(period.get().getId()).stream()
                .filter(slip -> "PUBLISHED".equals(slip.getStatus()))
                .sorted(Comparator.comparingInt(EmployeePayslip::getRevision).reversed())
                .forEach(slip -> result.putIfAbsent(slip.getEmployee().getEmployeeId(), slip));
        return result;
    }

    private EmployeeStatus row(EmployeeProfile profile, LocalDate reportDate, List<EmployeeLeaveRequest> leaveRequests,
                               EmployeePayslip publishedSlip) {
        LocalDate separation = profile.getResignationDate();
        String status = profile.getEmploymentStatus();
        if (separation != null && separation.isAfter(reportDate)) status = "ACTIVE";
        else if (separation != null && !separation.isAfter(reportDate)
                && "ACTIVE".equals(status)) status = "RESIGNED";
        boolean resignedInPeriod = "RESIGNED".equals(status) && separation != null
                && !separation.isBefore(reportDate.withDayOfMonth(1)) && !separation.isAfter(reportDate);
        long tenureMonths = tenureMonths(profile.getHireDate(), separation, reportDate);
        List<String> leaveTypes = leaveRequests.stream().map(EmployeeLeaveRequest::getRequestType).distinct().sorted().toList();
        BigDecimal salary = publishedSlip == null ? profile.getMonthlyBaseSalary() : publishedSlip.getContractedMonthlySalary();
        BigDecimal insurance = publishedSlip == null ? profile.getInsuranceSalaryBase() : publishedSlip.getInsuranceSalaryBase();
        return new EmployeeStatus(profile.getEmployeeId(), profile.getEmployeeCode(), profile.getAccount().getFullName(),
                profile.getJobTitle(), profile.getEducationLevel(), status, !leaveTypes.isEmpty(), leaveTypes,
                profile.getHireDate(), separation, resignedInPeriod, tenureMonths, salary, insurance,
                publishedSlip == null ? "CURRENT_PROFILE" : "PUBLISHED_PAYSLIP");
    }

    private static long tenureMonths(LocalDate hireDate, LocalDate separation, LocalDate reportDate) {
        LocalDate effectiveEnd = separation != null && separation.isBefore(reportDate) ? separation : reportDate;
        return Math.max(0, Period.between(hireDate, effectiveEnd).toTotalMonths());
    }

    private User requireHr(String authorization) {
        JwtTokenService.Claims claims = jwt.parse(authorization);
        User user = users.findById(claims.userId()).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Phiên đăng nhập không hợp lệ."));
        if (!"MANAGER_HR".equals(claims.role()) || !"MANAGER_HR".equals(user.getRole()) || user.isLocked() || user.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HR_ROLE_REQUIRED", "Chỉ nhân sự được xem báo cáo nhân sự.");
        }
        return user;
    }

    private static BigDecimal average(BigDecimal total, int count) {
        return count == 0 ? ZERO.setScale(2) : total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }
    private static String normalizeEducation(String value) { return value == null || value.isBlank() ? "Chưa cập nhật" : value.trim(); }
}
