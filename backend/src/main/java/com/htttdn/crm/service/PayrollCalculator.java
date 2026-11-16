package com.htttdn.crm.service;

import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/** Pure payroll arithmetic. All statutory values come from effective-dated HR settings. */
@Component
public final class PayrollCalculator {
    private static final int MONEY_SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private static final Set<String> ADJUSTMENT_TYPES = Set.of("EARNING", "BENEFIT", "DEDUCTION", "EMPLOYER_COST");

    public CalculationResult calculate(Input input, Rules rules) {
        validate(input, rules);

        BigDecimal base = money(input.contractedMonthlySalary()
                .divide(input.standardPaidWorkdays(), 12, ROUNDING)
                .multiply(input.paidEquivalentDays()));
        BigDecimal hourlyBase = input.contractedMonthlySalary()
                .divide(input.standardPaidWorkdays().multiply(rules.hoursPerWorkday()), 12, ROUNDING);

        BigDecimal normalOvertime = money(hourlyBase.multiply(input.overtimeNormalHours())
                .multiply(rules.normalOvertimeMultiplier()));
        BigDecimal restDayOvertime = money(hourlyBase.multiply(input.overtimeRestDayHours())
                .multiply(rules.restDayOvertimeMultiplier()));
        BigDecimal holidayOvertime = money(hourlyBase.multiply(input.overtimeHolidayHours())
                .multiply(rules.holidayOvertimeMultiplier()));
        BigDecimal nightPremium = money(hourlyBase.multiply(input.overtimeNightHours())
                .multiply(rules.nightWorkPremiumMultiplier()));
        BigDecimal overtime = money(normalOvertime.add(restDayOvertime).add(holidayOvertime).add(nightPremium));

        BigDecimal earningsAdjustments = sum(input.adjustments(), "EARNING");
        BigDecimal benefits = sum(input.adjustments(), "BENEFIT");
        BigDecimal otherDeductions = sum(input.adjustments(), "DEDUCTION");
        BigDecimal employerAdjustments = sum(input.adjustments(), "EMPLOYER_COST");
        BigDecimal gross = money(base.add(overtime).add(earningsAdjustments));
        BigDecimal assessedEmployeeInsurance = money(input.insuranceSalaryBase().multiply(rules.employeeInsuranceRate()));
        BigDecimal dependentAllowance = rules.dependentTaxAllowance().multiply(BigDecimal.valueOf(input.dependentCount()));
        BigDecimal taxableIncome = gross.subtract(assessedEmployeeInsurance)
                .subtract(rules.personalTaxAllowance()).subtract(dependentAllowance).max(BigDecimal.ZERO);
        BigDecimal assessedTax = progressiveTax(taxableIncome, rules.taxBrackets());
        // A payslip never creates a negative amount payable to an employee. If
        // deductions exceed this month's earnings, only the affordable amount
        // is withheld; HR must resolve any remaining obligation separately.
        BigDecimal availableForDeductions = gross.add(benefits);
        BigDecimal employeeInsurance = assessedEmployeeInsurance.min(availableForDeductions);
        BigDecimal remainingAfterInsurance = availableForDeductions.subtract(employeeInsurance);
        BigDecimal tax = assessedTax.min(remainingAfterInsurance);
        BigDecimal otherDeductionPaid = otherDeductions.min(remainingAfterInsurance.subtract(tax));
        BigDecimal deductions = money(employeeInsurance.add(tax).add(otherDeductionPaid));
        BigDecimal uncollectedDeductions = money(assessedEmployeeInsurance.add(assessedTax).add(otherDeductions)
                .subtract(deductions).max(BigDecimal.ZERO));
        BigDecimal employerContribution = money(input.insuranceSalaryBase().multiply(rules.employerContributionRate())
                .add(employerAdjustments));
        BigDecimal takeHome = money(gross.add(benefits).subtract(deductions));

        List<PayLine> lines = new ArrayList<>();
        addLine(lines, "EARNING", "PRORATED_BASE", "Lương cơ bản theo ngày công", base);
        addLine(lines, "EARNING", "OVERTIME_NORMAL", "Tăng ca ngày thường", normalOvertime);
        addLine(lines, "EARNING", "OVERTIME_REST_DAY", "Tăng ca ngày nghỉ hằng tuần", restDayOvertime);
        addLine(lines, "EARNING", "OVERTIME_HOLIDAY", "Tăng ca ngày lễ", holidayOvertime);
        addLine(lines, "EARNING", "NIGHT_WORK_PREMIUM", "Phụ cấp làm việc ban đêm", nightPremium);
        addAdjustments(lines, input.adjustments(), otherDeductionPaid);
        addLine(lines, "DEDUCTION", "EMPLOYEE_INSURANCE", "Các khoản bảo hiểm người lao động", employeeInsurance);
        addLine(lines, "DEDUCTION", "PERSONAL_INCOME_TAX", "Thuế thu nhập cá nhân", tax);
        addLine(lines, "EMPLOYER_COST", "EMPLOYER_CONTRIBUTION", "Khoản đóng của người sử dụng lao động", money(
                input.insuranceSalaryBase().multiply(rules.employerContributionRate())));

        return new CalculationResult(base, overtime, gross, benefits, employeeInsurance, tax, deductions,
                employerContribution, takeHome, uncollectedDeductions, lines);
    }

    private static BigDecimal progressiveTax(BigDecimal taxableIncome, List<TaxBracket> brackets) {
        BigDecimal tax = BigDecimal.ZERO;
        List<TaxBracket> ordered = brackets.stream().sorted(Comparator.comparing(TaxBracket::lowerBound)).toList();
        for (TaxBracket bracket : ordered) {
            if (taxableIncome.compareTo(bracket.lowerBound()) <= 0) continue;
            BigDecimal top = bracket.upperBound() == null ? taxableIncome : taxableIncome.min(bracket.upperBound());
            BigDecimal taxableInBracket = top.subtract(bracket.lowerBound()).max(BigDecimal.ZERO);
            tax = tax.add(taxableInBracket.multiply(bracket.rate()));
        }
        return money(tax);
    }

    private static BigDecimal sum(List<Adjustment> adjustments, String type) {
        return money(adjustments.stream().filter(line -> type.equals(line.lineType()))
                .map(Adjustment::amount).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private static void addAdjustments(List<PayLine> lines, List<Adjustment> adjustments, BigDecimal deductionLimit) {
        BigDecimal remainingDeductions = deductionLimit;
        for (Adjustment adjustment : adjustments) {
            BigDecimal amount = adjustment.amount();
            if ("DEDUCTION".equals(adjustment.lineType())) {
                amount = amount.min(remainingDeductions);
                remainingDeductions = remainingDeductions.subtract(amount);
            }
            addLine(lines, adjustment.lineType(), adjustment.code(), adjustment.description(), amount);
        }
    }

    private static void addLine(List<PayLine> lines, String type, String code, String description, BigDecimal amount) {
        if (amount.signum() > 0) lines.add(new PayLine(type, code, description, money(amount)));
    }

    private static void validate(Input input, Rules rules) {
        if (input == null || rules == null) throw new IllegalArgumentException("Payroll input and rules are required.");
        requireNonNegative(input.contractedMonthlySalary(), "Contracted monthly salary");
        requireNonNegative(input.insuranceSalaryBase(), "Insurance salary base");
        requirePositive(input.standardPaidWorkdays(), "Standard paid workdays");
        requireNonNegative(input.paidEquivalentDays(), "Paid equivalent days");
        if (input.paidEquivalentDays().compareTo(input.standardPaidWorkdays()) > 0) {
            throw new IllegalArgumentException("Paid equivalent days cannot exceed standard paid workdays.");
        }
        requireNonNegative(input.overtimeNormalHours(), "Normal overtime hours");
        requireNonNegative(input.overtimeRestDayHours(), "Rest day overtime hours");
        requireNonNegative(input.overtimeHolidayHours(), "Holiday overtime hours");
        requireNonNegative(input.overtimeNightHours(), "Night overtime hours");
        if (input.dependentCount() < 0) throw new IllegalArgumentException("Dependent count cannot be negative.");
        requirePositive(rules.hoursPerWorkday(), "Hours per workday");
        requireNonNegative(rules.normalOvertimeMultiplier(), "Normal overtime multiplier");
        requireNonNegative(rules.restDayOvertimeMultiplier(), "Rest day overtime multiplier");
        requireNonNegative(rules.holidayOvertimeMultiplier(), "Holiday overtime multiplier");
        requireNonNegative(rules.nightWorkPremiumMultiplier(), "Night work premium multiplier");
        requireNonNegative(rules.employeeInsuranceRate(), "Employee insurance rate");
        requireNonNegative(rules.employerContributionRate(), "Employer contribution rate");
        requireNonNegative(rules.personalTaxAllowance(), "Personal tax allowance");
        requireNonNegative(rules.dependentTaxAllowance(), "Dependent tax allowance");
        if (input.adjustments() == null || rules.taxBrackets() == null) {
            throw new IllegalArgumentException("Payroll adjustments and tax brackets are required.");
        }
        for (Adjustment adjustment : input.adjustments()) {
            if (adjustment == null || !ADJUSTMENT_TYPES.contains(adjustment.lineType())
                    || adjustment.code() == null || adjustment.code().isBlank()
                    || adjustment.description() == null || adjustment.description().isBlank()) {
                throw new IllegalArgumentException("Payroll adjustment requires a supported type, code, and description.");
            }
            requireNonNegative(adjustment.amount(), "Payroll adjustment amount");
        }
        for (TaxBracket bracket : rules.taxBrackets()) {
            requireNonNegative(bracket.lowerBound(), "Tax bracket lower bound");
            requireNonNegative(bracket.rate(), "Tax bracket rate");
            if (bracket.upperBound() != null && bracket.upperBound().compareTo(bracket.lowerBound()) <= 0) {
                throw new IllegalArgumentException("Tax bracket upper bound must be greater than lower bound.");
            }
            if (bracket.rate().compareTo(BigDecimal.ONE) > 0) throw new IllegalArgumentException("Tax bracket rate must be a fraction.");
        }
        List<TaxBracket> orderedBrackets = rules.taxBrackets().stream()
                .sorted(Comparator.comparing(TaxBracket::lowerBound)).toList();
        if (!orderedBrackets.isEmpty()) {
            if (orderedBrackets.getFirst().lowerBound().signum() != 0
                    || orderedBrackets.getLast().upperBound() != null) {
                throw new IllegalArgumentException("Tax brackets must start at zero and have an open-ended final bracket.");
            }
            for (int index = 0; index < orderedBrackets.size() - 1; index++) {
                TaxBracket current = orderedBrackets.get(index);
                TaxBracket next = orderedBrackets.get(index + 1);
                if (current.upperBound() == null || current.upperBound().compareTo(next.lowerBound()) != 0) {
                    throw new IllegalArgumentException("Tax brackets must be contiguous and non-overlapping.");
                }
            }
        }
    }

    private static void requirePositive(BigDecimal value, String name) {
        requireNonNegative(value, name);
        if (value.signum() == 0) throw new IllegalArgumentException(name + " must be positive.");
    }

    private static void requireNonNegative(BigDecimal value, String name) {
        if (value == null || value.signum() < 0) throw new IllegalArgumentException(name + " must be non-negative.");
    }

    private static BigDecimal money(BigDecimal value) { return value.setScale(MONEY_SCALE, ROUNDING); }

    public record Input(BigDecimal contractedMonthlySalary, BigDecimal insuranceSalaryBase,
                        BigDecimal standardPaidWorkdays, BigDecimal paidEquivalentDays,
                        BigDecimal overtimeNormalHours, BigDecimal overtimeRestDayHours,
                        BigDecimal overtimeHolidayHours, BigDecimal overtimeNightHours,
                        int dependentCount, List<Adjustment> adjustments) {}

    public record Rules(BigDecimal hoursPerWorkday, BigDecimal normalOvertimeMultiplier,
                        BigDecimal restDayOvertimeMultiplier, BigDecimal holidayOvertimeMultiplier,
                        BigDecimal nightWorkPremiumMultiplier, BigDecimal employeeInsuranceRate,
                        BigDecimal employerContributionRate, BigDecimal personalTaxAllowance,
                        BigDecimal dependentTaxAllowance, List<TaxBracket> taxBrackets) {}

    public record TaxBracket(BigDecimal lowerBound, BigDecimal upperBound, BigDecimal rate) {}
    public record Adjustment(String lineType, String code, String description, BigDecimal amount) {}
    public record PayLine(String lineType, String code, String description, BigDecimal amount) {}
    public record CalculationResult(BigDecimal proratedBase, BigDecimal overtimePay, BigDecimal grossEarnings,
                                    BigDecimal separateBenefits, BigDecimal employeeInsurance,
                                    BigDecimal personalIncomeTax, BigDecimal employeeDeductions,
                                    BigDecimal employerContributions, BigDecimal takeHomePay,
                                    BigDecimal uncollectedDeductions,
                                    List<PayLine> lines) {}
}
