package com.cnpm.clothingstore.service.payroll;

import com.cnpm.clothingstore.dto.hr.PayrollDtos.*;
import com.cnpm.clothingstore.entity.*;
import com.cnpm.clothingstore.repository.*;
import java.math.BigDecimal;
import java.util.*;
import static com.cnpm.clothingstore.service.payroll.PayrollJsonNumbers.*;
import static com.cnpm.clothingstore.service.payroll.PayrollAdjustments.*;

public final class PayrollViewMapper {
    private final EmployeePayslipRepository payslips;
    private final EmployeePayrollLineRepository lines;
    public PayrollViewMapper(EmployeePayslipRepository payslips, EmployeePayrollLineRepository lines) { this.payslips = payslips; this.lines = lines; }
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    public PeriodView periodView(EmployeePayrollPeriod period) {
        List<EmployeePayslip> all = payslips.findAllForPeriod(period.getId());
        Map<Long, EmployeePayslip> latest = new LinkedHashMap<>();
        all.stream().sorted(Comparator.comparingLong(EmployeePayslip::getId).reversed()).forEach(slip -> latest.putIfAbsent(slip.getEmployee().getEmployeeId(), slip));
        List<PayslipView> views = latest.values().stream().sorted(Comparator.comparing(slip -> slip.getEmployee().getEmployeeId())).map(this::payslipView).toList();
        return new PeriodView(period.getId(), period.getPeriodYear(), period.getPeriodMonth(), period.getStandardPaidWorkdays(),
                period.getStatus(), period.getCreatedAt(), period.getReviewedAt(), period.getPublishedAt(), views);
    }

    public PayslipView payslipView(EmployeePayslip slip) {
        EmployeeProfile profile = slip.getEmployee(); User account = profile.getAccount();
        List<LineView> details = lines.findByPayslip_IdOrderByDisplayOrderAscIdAsc(slip.getId()).stream()
                .map(line -> new LineView(line.getId(), line.getLineType(), line.getCode(), line.getDescription(), line.getQuantity(), line.getRate(), line.getAmount(), line.getDisplayOrder())).toList();
        String snapshotCode = slip.getSourceSnapshot().path("employeeCode").asText(profile.getEmployeeCode());
        String snapshotName = slip.getSourceSnapshot().path("employeeName").asText(account.getFullName());
        BigDecimal uncollected = slip.getSourceSnapshot().path("uncollectedDeductions").isNumber()
                ? slip.getSourceSnapshot().path("uncollectedDeductions").decimalValue() : ZERO;
        return new PayslipView(slip.getId(), profile.getEmployeeId(), snapshotCode, snapshotName,
                slip.getPeriod().getPeriodYear(), slip.getPeriod().getPeriodMonth(), slip.getRevision(), slip.getStatus(),
                slip.getContractedMonthlySalary(), slip.getInsuranceSalaryBase(), slip.getPaidEquivalentDays(), slip.getGrossEarnings(),
                slip.getSeparateBenefits(), slip.getEmployeeDeductions(), slip.getEmployerContributions(), slip.getTakeHomePay(), uncollected,
                slip.getSourceSnapshot(), details, slip.getCreatedAt(), slip.getPublishedAt());
    }

    public static SettingView settingView(PayrollSetting row) { return new SettingView(row.getId(), row.getSettingKey(), row.getEffectiveFrom(), row.getEffectiveTo(), row.getSettingValue(), row.getNote()); }
}
