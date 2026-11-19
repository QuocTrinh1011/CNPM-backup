package com.htttdn.crm.service;

import com.htttdn.crm.service.payroll.*;
import com.htttdn.crm.service.payroll.PayrollRulesParser.ConfiguredRules;
import static com.htttdn.crm.service.payroll.PayrollJsonNumbers.*;
import static com.htttdn.crm.service.payroll.PayrollAdjustments.*;
import static com.htttdn.crm.service.payroll.PayrollInputAssembler.*;
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

@Service
public class EmployeePayrollService {
    private final PayrollRulesParser payrollRules;
    private final PayrollSnapshotCodec snapshots;
    private final PayrollViewMapper views;
    private static final String RULE_KEY = "PAYROLL_RULES";
    private static final Set<String> ADJUSTMENT_TYPES = Set.of("EARNING", "BENEFIT", "DEDUCTION", "EMPLOYER_COST");
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private final EmployeePayrollPeriodRepository periods;
    private final EmployeePayslipRepository payslips;
    private final EmployeePayrollLineRepository lines;
    private final PayrollSettingRepository settings;
    private final EmployeeProfileRepository profiles;
    private final EmployeeAttendanceRepository attendance;
    private final EmployeeLeaveRequestRepository leaves;
    private final EmployeeAccessService employeeAccess;
    private final UserRepository users;
    private final JwtTokenService jwt;
    private final PayrollCalculator calculator;
    private final AuditTrail audit;
    private final ObjectMapper mapper;

    public EmployeePayrollService(EmployeePayrollPeriodRepository periods, EmployeePayslipRepository payslips,
                                  EmployeePayrollLineRepository lines, PayrollSettingRepository settings,
                                  EmployeeProfileRepository profiles, EmployeeAttendanceRepository attendance,
                                  EmployeeLeaveRequestRepository leaves, EmployeeAccessService employeeAccess,
                                  UserRepository users, JwtTokenService jwt, PayrollCalculator calculator,
                                  AuditTrail audit, ObjectMapper mapper) {
        this.periods = periods; this.payslips = payslips; this.lines = lines; this.settings = settings;
        this.profiles = profiles; this.attendance = attendance; this.leaves = leaves;
        this.employeeAccess = employeeAccess; this.users = users; this.jwt = jwt;
        this.calculator = calculator; this.audit = audit; this.mapper = mapper;
        this.payrollRules = new PayrollRulesParser(calculator);
        this.snapshots = new PayrollSnapshotCodec(mapper);
        this.views = new PayrollViewMapper(payslips, lines);
    }

    @Transactional(readOnly = true)
    public SettingView effectiveSetting(String authorization, LocalDate asOf) {
        requireHr(authorization);
        return views.settingView(effective(asOf == null ? LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")) : asOf));
    }

    @Transactional
    public SettingView saveSetting(String authorization, SettingRequest input) {
        User actor = requireHr(authorization);
        if (input == null || !RULE_KEY.equals(normalize(input.settingKey())) || input.effectiveFrom() == null
                || input.settingValue() == null || input.settingValue().isNull()) {
            throw bad("INVALID_PAYROLL_SETTING", "Cần khóa PAYROLL_RULES, ngày hiệu lực và cấu hình hợp lệ.");
        }
        payrollRules.parseRules(input.settingValue());
        if (input.effectiveTo() != null && !input.effectiveTo().isAfter(input.effectiveFrom())) {
            throw bad("INVALID_PAYROLL_SETTING_DATES", "Ngày kết thúc hiệu lực phải bằng hoặc sau ngày bắt đầu.");
        }
        List<PayrollSetting> history = settings.findAllForUpdate(RULE_KEY);
        if (history.stream().anyMatch(row -> row.getEffectiveFrom().equals(input.effectiveFrom()))) {
            throw new ApiException(HttpStatus.CONFLICT, "PAYROLL_SETTING_EXISTS", "Đã có cấu hình bắt đầu hiệu lực vào ngày này.");
        }
        LocalDate nextStart = history.stream().map(PayrollSetting::getEffectiveFrom)
                .filter(date -> date.isAfter(input.effectiveFrom())).min(LocalDate::compareTo).orElse(null);
        LocalDate end = input.effectiveTo();
        if (nextStart != null) {
            LocalDate beforeNext = nextStart.minusDays(1);
            if (end != null && end.isAfter(beforeNext)) throw bad("OVERLAPPING_PAYROLL_SETTING", "Khoảng hiệu lực bị chồng với cấu hình tiếp theo.");
            if (end == null) end = beforeNext;
        }
        for (PayrollSetting previous : history) {
            if (previous.getEffectiveFrom().isBefore(input.effectiveFrom())
                    && (previous.getEffectiveTo() == null || !previous.getEffectiveTo().isBefore(input.effectiveFrom()))) {
                previous.setEffectiveTo(input.effectiveFrom().minusDays(1));
            }
        }
        settings.saveAll(history);
        PayrollSetting row = new PayrollSetting();
        row.setSettingKey(RULE_KEY); row.setEffectiveFrom(input.effectiveFrom()); row.setEffectiveTo(end);
        row.setSettingValue(input.settingValue().deepCopy()); row.setNote(normalizeNullable(input.note())); row.setUpdatedBy(actor);
        try {
            settings.saveAndFlush(row);
        } catch (DataIntegrityViolationException duplicate) {
            throw conflict("PAYROLL_SETTING_EXISTS", "Cấu hình hiệu lực này vừa được tạo bởi một yêu cầu khác.");
        }
        audit.recordAs(actor(actor), "CREATE", "HR_PAYROLL_SETTING", row.getId(), Map.of(), settingSnapshot(row));
        return views.settingView(row);
    }

    @Transactional(readOnly = true)
    public List<PeriodView> listPeriods(String authorization, Integer year) {
        requireHr(authorization);
        return periods.findAll().stream().filter(period -> year == null || period.getPeriodYear() == year)
                .sorted(Comparator.comparing(EmployeePayrollPeriod::getPeriodYear).reversed()
                        .thenComparing(EmployeePayrollPeriod::getPeriodMonth, Comparator.reverseOrder()))
                .map(period -> views.periodView(period)).toList();
    }

    @Transactional
    public PeriodView generate(String authorization, PeriodRequest request) {
        User actor = requireHr(authorization);
        if (request == null || request.year() == null || request.month() == null
                || request.year() < 2000 || request.year() > 2100 || request.month() < 1 || request.month() > 12
                || request.standardPaidWorkdays() == null || request.standardPaidWorkdays().signum() <= 0
                || request.standardPaidWorkdays().compareTo(new BigDecimal("31")) > 0) {
            throw bad("INVALID_PAYROLL_PERIOD", "Năm, tháng hoặc số ngày công chuẩn không hợp lệ.");
        }
        if (request.dependentCounts() != null && request.dependentCounts().values().stream().anyMatch(value -> value == null || value < 0)) {
            throw bad("INVALID_DEPENDENT_COUNT", "Số người phụ thuộc không được âm.");
        }
        YearMonth yearMonth = YearMonth.of(request.year(), request.month());
        if (periods.findForUpdate(request.year(), request.month()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "PAYROLL_PERIOD_EXISTS", "Kỳ lương này đã được tạo.");
        }
        List<PayrollSetting> rulesHistory = settings.findAllForUpdate(RULE_KEY);
        PayrollSetting setting = effective(yearMonth.atDay(1));
        boolean settingsChangeMidPeriod = rulesHistory.stream()
                .anyMatch(row -> row.getEffectiveFrom().isAfter(yearMonth.atDay(1))
                        && !row.getEffectiveFrom().isAfter(yearMonth.atEndOfMonth()));
        if (settingsChangeMidPeriod || setting.getEffectiveTo() != null && setting.getEffectiveTo().isBefore(yearMonth.atEndOfMonth())) {
            throw conflict("PAYROLL_RULE_CHANGE_WITHIN_PERIOD", "Cấu hình lương thay đổi giữa kỳ; cần chia kỳ hoặc chốt cấu hình hiệu lực cho trọn tháng trước khi tạo bảng lương.");
        }
        ConfiguredRules configured = payrollRules.parseRules(setting.getSettingValue());
        List<EmployeeProfile> employees = profiles.findEligibleForPayroll(yearMonth.atDay(1), yearMonth.atEndOfMonth());
        List<EmployeeAttendance> monthAttendance = attendance.findPayrollRange(yearMonth.atDay(1), yearMonth.atEndOfMonth());
        Map<Long, List<EmployeeAttendance>> attendanceByEmployee = monthAttendance.stream()
                .collect(Collectors.groupingBy(row -> row.getEmployee().getEmployeeId()));
        List<EmployeeLeaveRequest> approvedLeaves = leaves.findApprovedOverlapping(yearMonth.atDay(1), yearMonth.atEndOfMonth());
        Map<Long, List<EmployeeLeaveRequest>> leavesByEmployee = approvedLeaves.stream()
                .collect(Collectors.groupingBy(row -> row.getEmployee().getEmployeeId()));

        EmployeePayrollPeriod period = new EmployeePayrollPeriod();
        period.setPeriodYear(request.year()); period.setPeriodMonth(request.month());
        period.setStandardPaidWorkdays(request.standardPaidWorkdays()); period.setCreatedBy(actor);
        try {
            periods.saveAndFlush(period);
        } catch (DataIntegrityViolationException duplicate) {
            throw conflict("PAYROLL_PERIOD_EXISTS", "Kỳ lương này vừa được tạo bởi một yêu cầu khác.");
        }
        for (EmployeeProfile employee : employees) {
            int dependentCount = request.dependentCounts() == null ? 0 : request.dependentCounts().getOrDefault(employee.getEmployeeId(), 0);
            List<EmployeeAttendance> employeeAttendance = attendanceByEmployee.getOrDefault(employee.getEmployeeId(), List.of());
            List<EmployeeLeaveRequest> employeeLeaves = leavesByEmployee.getOrDefault(employee.getEmployeeId(), List.of());
            PayrollCalculator.Input input = payrollInput(employee, yearMonth, request.standardPaidWorkdays(), dependentCount,
                    configured, employeeAttendance, employeeLeaves);
            JsonNode snapshot = snapshots.sourceSnapshot(employee, input, setting.getSettingValue(), employeeAttendance, employeeLeaves, configured);
            EmployeePayslip slip = new EmployeePayslip();
            slip.setPeriod(period); slip.setEmployee(employee); slip.setRevision(1); slip.setStatus("DRAFT");
            slip.setContractedMonthlySalary(employee.getMonthlyBaseSalary()); slip.setInsuranceSalaryBase(employee.getInsuranceSalaryBase());
            slip.setPaidEquivalentDays(input.paidEquivalentDays()); slip.setSourceSnapshot(snapshot);
            PayrollCalculator.CalculationResult result = calculator.calculate(input, configured.calculationRules());
            applyCalculation(slip, result);
            payslips.saveAndFlush(slip);
            saveLines(slip, result.lines());
        }
        audit.recordAs(actor(actor), "GENERATE", "EMPLOYEE_PAYROLL_PERIOD", period.getId(), Map.of(), periodSnapshot(period));
        return views.periodView(period);
    }

    @Transactional(readOnly = true)
    public PeriodView getPeriod(String authorization, int year, int month) {
        requireHr(authorization);
        validatePeriod(year, month);
        EmployeePayrollPeriod period = periods.findByPeriodYearAndPeriodMonth(year, month).orElseThrow(this::periodNotFound);
        return views.periodView(period);
    }

    @Transactional
    public PeriodView review(String authorization, int year, int month) {
        User actor = requireHr(authorization); EmployeePayrollPeriod period = lockedPeriod(year, month);
        if (!"DRAFT".equals(period.getStatus())) throw conflict("PAYROLL_NOT_DRAFT", "Chỉ có thể duyệt kỳ lương ở trạng thái nháp.");
        Map<String, Object> before = periodSnapshot(period);
        period.setStatus("REVIEWED"); period.setReviewedBy(actor); period.setReviewedAt(Instant.now());
        payslips.findAllForPeriod(period.getId()).forEach(slip -> slip.setStatus("REVIEWED"));
        periods.saveAndFlush(period);
        audit.recordAs(actor(actor), "REVIEW", "EMPLOYEE_PAYROLL_PERIOD", period.getId(), before, periodSnapshot(period));
        return views.periodView(period);
    }

    @Transactional
    public PeriodView publish(String authorization, int year, int month) {
        User actor = requireHr(authorization); EmployeePayrollPeriod period = lockedPeriod(year, month);
        if (!"REVIEWED".equals(period.getStatus())) throw conflict("PAYROLL_NOT_REVIEWED", "Cần duyệt kỳ lương trước khi công bố.");
        Map<String, Object> before = periodSnapshot(period); Instant now = Instant.now();
        period.setStatus("PUBLISHED"); period.setPublishedBy(actor); period.setPublishedAt(now);
        payslips.findAllForPeriod(period.getId()).forEach(slip -> { slip.setStatus("PUBLISHED"); slip.setPublishedAt(now); });
        periods.saveAndFlush(period);
        audit.recordAs(actor(actor), "PUBLISH", "EMPLOYEE_PAYROLL_PERIOD", period.getId(), before, periodSnapshot(period));
        return views.periodView(period);
    }

    @Transactional
    public PayslipView adjustDraft(String authorization, int year, int month, AdjustmentRequest request) {
        User actor = requireHr(authorization); EmployeePayrollPeriod period = lockedPeriod(year, month);
        if (!"DRAFT".equals(period.getStatus())) throw conflict("PAYROLL_NOT_DRAFT", "Chỉ có thể điều chỉnh kỳ lương nháp.");
        validateAdjustment(request == null ? null : request.lineType(), request == null ? null : request.code(),
                request == null ? null : request.description(), request == null ? null : request.amount());
        EmployeePayslip slip = latestRevision(period.getId(), request.employeeId());
        Map<String, Object> before = payslipSnapshot(slip);
        JsonNode source = slip.getSourceSnapshot().deepCopy();
        PayrollCalculator.Input input = appendAdjustment(snapshots.readInput(source.path("input")), adjustment(request.lineType(), request.code(), request.description(), request.amount()));
        ((ObjectNode) source).set("input", snapshots.inputSnapshot(input));
        ConfiguredRules configured = payrollRules.parseRules(source.path("rules"));
        slip.setSourceSnapshot(source);
        PayrollCalculator.CalculationResult result = calculator.calculate(input, configured.calculationRules());
        applyCalculation(slip, result);
        payslips.saveAndFlush(slip); replaceLines(slip, result.lines());
        audit.recordAs(actor(actor), "ADJUST", "EMPLOYEE_PAYSLIP", slip.getId(), before, payslipSnapshot(slip));
        return views.payslipView(slip);
    }

    @Transactional
    public PayslipView correctPublished(String authorization, int year, int month, long employeeId, CorrectionRequest request) {
        User actor = requireHr(authorization); EmployeePayrollPeriod period = lockedPeriod(year, month);
        if (!"PUBLISHED".equals(period.getStatus())) throw conflict("PAYROLL_NOT_PUBLISHED", "Chỉ có thể tạo revision cho bảng lương đã công bố.");
        validateAdjustment(request == null ? null : request.lineType(), request == null ? null : request.code(),
                request == null ? null : request.description(), request == null ? null : request.amount());
        EmployeePayslip previous = payslips.findLatestPublished(employeeId, year, month).orElseThrow(this::payslipNotFound);
        JsonNode source = previous.getSourceSnapshot().deepCopy();
        PayrollCalculator.Input input = appendAdjustment(snapshots.readInput(source.path("input")), adjustment(request.lineType(), request.code(), request.description(), request.amount()));
        ((ObjectNode) source).set("input", snapshots.inputSnapshot(input));
        ConfiguredRules configured = payrollRules.parseRules(source.path("rules"));
        EmployeePayslip revision = new EmployeePayslip();
        revision.setPeriod(period); revision.setEmployee(previous.getEmployee()); revision.setRevision(previous.getRevision() + 1);
        revision.setStatus("PUBLISHED"); revision.setPublishedAt(Instant.now()); revision.setReplacesPayslip(previous);
        revision.setContractedMonthlySalary(previous.getContractedMonthlySalary()); revision.setInsuranceSalaryBase(previous.getInsuranceSalaryBase());
        revision.setPaidEquivalentDays(previous.getPaidEquivalentDays()); revision.setSourceSnapshot(source);
        PayrollCalculator.CalculationResult result = calculator.calculate(input, configured.calculationRules());
        applyCalculation(revision, result); payslips.saveAndFlush(revision);
        saveLines(revision, result.lines());
        audit.recordAs(actor(actor), "CORRECT", "EMPLOYEE_PAYSLIP", revision.getId(), payslipSnapshot(previous), payslipSnapshot(revision));
        return views.payslipView(revision);
    }

    @Transactional(readOnly = true)
    public List<PayslipView> mineForYear(String authorization, int year) {
        if (year < 2000 || year > 2100) throw bad("INVALID_PAYROLL_PERIOD", "Năm xem bảng lương không hợp lệ.");
        EmployeeProfile employee = employeeAccess.requireEmployee(authorization);
        return payslips.findLatestPublishedForYear(employee.getEmployeeId(), year).stream().map(views::payslipView).toList();
    }

    @Transactional(readOnly = true)
    public PayslipView mineForMonth(String authorization, int year, int month) {
        validatePeriod(year, month); EmployeeProfile employee = employeeAccess.requireEmployee(authorization);
        return payslips.findLatestPublished(employee.getEmployeeId(), year, month).map(views::payslipView).orElseThrow(this::payslipNotFound);
    }

    private PayrollSetting effective(LocalDate date) {
        List<PayrollSetting> found = settings.findEffective(RULE_KEY, date);
        if (found.size() != 1) throw new ApiException(HttpStatus.CONFLICT, "PAYROLL_RULES_NOT_CONFIGURED", "Chưa có đúng một bộ PAYROLL_RULES hiệu lực vào ngày " + date + ".");
        return found.getFirst();
    }

    private EmployeePayrollPeriod lockedPeriod(int year, int month) {
        validatePeriod(year, month); return periods.findForUpdate(year, month).orElseThrow(this::periodNotFound);
    }

    private void applyCalculation(EmployeePayslip slip, PayrollCalculator.CalculationResult result) {
        slip.setGrossEarnings(result.grossEarnings()); slip.setSeparateBenefits(result.separateBenefits());
        slip.setEmployeeDeductions(result.employeeDeductions()); slip.setEmployerContributions(result.employerContributions());
        slip.setTakeHomePay(result.takeHomePay());
        ((ObjectNode) slip.getSourceSnapshot()).put("uncollectedDeductions", result.uncollectedDeductions());
    }

    private void saveLines(EmployeePayslip slip, List<PayrollCalculator.PayLine> details) {
        int order = 0;
        for (PayrollCalculator.PayLine detail : details) {
            EmployeePayrollLine line = new EmployeePayrollLine(); line.setPayslip(slip); line.setLineType(detail.lineType());
            line.setCode(detail.code()); line.setDescription(detail.description()); line.setAmount(detail.amount()); line.setDisplayOrder(order++);
            lines.save(line);
        }
        lines.flush();
    }

    private void replaceLines(EmployeePayslip slip, List<PayrollCalculator.PayLine> details) {
        lines.deleteAll(lines.findByPayslip_IdOrderByDisplayOrderAscIdAsc(slip.getId())); lines.flush(); saveLines(slip, details);
    }

    private EmployeePayslip latestRevision(Long periodId, Long employeeId) {
        if (employeeId == null) throw bad("EMPLOYEE_REQUIRED", "Cần chọn nhân viên.");
        return payslips.findRevisions(periodId, employeeId).stream().findFirst().orElseThrow(this::payslipNotFound);
    }

    private static Map<String, Object> periodSnapshot(EmployeePayrollPeriod period) { return Map.of("year", period.getPeriodYear(), "month", period.getPeriodMonth(), "status", period.getStatus(), "standardPaidWorkdays", period.getStandardPaidWorkdays()); }
    private static Map<String, Object> payslipSnapshot(EmployeePayslip slip) { return Map.of("employeeId", slip.getEmployee().getEmployeeId(), "periodId", slip.getPeriod().getId(), "revision", slip.getRevision(), "status", slip.getStatus(), "grossEarnings", slip.getGrossEarnings(), "employeeDeductions", slip.getEmployeeDeductions(), "takeHomePay", slip.getTakeHomePay()); }
    private static Map<String, Object> settingSnapshot(PayrollSetting row) { return Map.of("settingKey", row.getSettingKey(), "effectiveFrom", row.getEffectiveFrom(), "effectiveTo", row.getEffectiveTo() == null ? "" : row.getEffectiveTo(), "settingValue", row.getSettingValue()); }

    private User requireHr(String authorization) {
        JwtTokenService.Claims claims = jwt.parse(authorization);
        User user = users.findById(claims.userId()).orElseThrow(this::periodNotFound);
        if (!"MANAGER_HR".equals(claims.role()) || !"MANAGER_HR".equals(user.getRole()) || user.isLocked() || user.getDeletedAt() != null)
            throw new ApiException(HttpStatus.FORBIDDEN, "HR_ROLE_REQUIRED", "Chỉ nhân sự được quản lý bảng lương.");
        return user;
    }
    private static AuditTrail.Actor actor(User user) { return new AuditTrail.Actor(user.getId(), user.getFullName(), user.getRole()); }

    private static String normalizeNullable(String value) { if (value == null) return null; String normalized = value.trim(); return normalized.isEmpty() ? null : normalized; }
    private static void validatePeriod(int year, int month) { if (year < 2000 || year > 2100 || month < 1 || month > 12) throw bad("INVALID_PAYROLL_PERIOD", "Tháng hoặc năm xem bảng lương không hợp lệ."); }
    private ApiException periodNotFound() { return new ApiException(HttpStatus.NOT_FOUND, "PAYROLL_PERIOD_NOT_FOUND", "Không tìm thấy kỳ lương."); }
    private ApiException payslipNotFound() { return new ApiException(HttpStatus.NOT_FOUND, "PAYSLIP_NOT_FOUND", "Không tìm thấy bảng lương đã công bố."); }
    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
    private static ApiException conflict(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }
}
