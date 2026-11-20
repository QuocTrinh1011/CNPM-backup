package com.htttdn.crm.service.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.htttdn.crm.dto.hr.PayrollDtos.*;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import com.htttdn.crm.service.PayrollCalculator;
import com.htttdn.crm.service.payroll.PayrollRulesParser.ConfiguredRules;
import static com.htttdn.crm.service.payroll.PayrollJsonNumbers.*;
import static com.htttdn.crm.service.payroll.PayrollAdjustments.*;

public final class PayrollRulesParser {
    private final PayrollCalculator calculator;
    public PayrollRulesParser(PayrollCalculator calculator) { this.calculator = calculator; }
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    public ConfiguredRules parseRules(JsonNode node) {
        try {
            BigDecimal hours = decimal(node, "hoursPerWorkday");
            BigDecimal normal = decimal(node, "normalOvertimeMultiplier"); BigDecimal rest = decimal(node, "restDayOvertimeMultiplier");
            BigDecimal holiday = decimal(node, "holidayOvertimeMultiplier"); BigDecimal night = decimal(node, "nightWorkPremiumMultiplier");
            BigDecimal nightAdditional = decimalOrDefault(node, "nightOvertimeAdditionalMultiplier", new BigDecimal("0.2"));
            BigDecimal employeeInsurance = decimal(node, "employeeInsuranceRate"); BigDecimal employerRate = decimal(node, "employerContributionRate");
            BigDecimal personalAllowance = decimal(node, "personalTaxAllowance"); BigDecimal dependentAllowance = decimal(node, "dependentTaxAllowance");
            List<PayrollCalculator.TaxBracket> brackets = new ArrayList<>();
            JsonNode bracketNodes = node.path("taxBrackets");
            if (!bracketNodes.isArray()) throw new IllegalArgumentException("taxBrackets must be an array");
            bracketNodes.forEach(row -> brackets.add(new PayrollCalculator.TaxBracket(decimal(row, "lowerBound"),
                    row.hasNonNull("upperBound") ? decimal(row, "upperBound") : null, decimal(row, "rate"))));
            List<Integer> weekdays = new ArrayList<>();
            JsonNode weekdayNodes = node.path("workingWeekdays");
            if (!weekdayNodes.isArray() || weekdayNodes.isEmpty()) throw new IllegalArgumentException("workingWeekdays is required");
            weekdayNodes.forEach(value -> { if (!value.canConvertToInt() || value.asInt() < 1 || value.asInt() > 7) throw new IllegalArgumentException("workingWeekdays must use ISO days 1-7"); weekdays.add(value.asInt()); });
            if (new HashSet<>(weekdays).size() != weekdays.size()) throw new IllegalArgumentException("workingWeekdays contains duplicates");
            Set<LocalDate> holidays = new HashSet<>();
            JsonNode holidayNodes = node.path("publicHolidays");
            if (!holidayNodes.isArray()) throw new IllegalArgumentException("publicHolidays must be an array");
            holidayNodes.forEach(value -> holidays.add(LocalDate.parse(value.asText())));
            PayrollCalculator.Rules calculation = new PayrollCalculator.Rules(hours, normal, rest, holiday, night, nightAdditional,
                    employeeInsurance, employerRate, personalAllowance, dependentAllowance, brackets);
            calculator.calculate(new PayrollCalculator.Input(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ONE, BigDecimal.ZERO,
                    ZERO, ZERO, ZERO, ZERO, 0, List.of()), calculation);
            if (employeeInsurance.compareTo(BigDecimal.ONE) > 0 || employerRate.compareTo(BigDecimal.ONE) > 0) throw new IllegalArgumentException("Insurance rates must be fractions");
            return new ConfiguredRules(calculation, List.copyOf(weekdays), Set.copyOf(holidays));
        } catch (RuntimeException error) {
            throw bad("INVALID_PAYROLL_RULES", "Cấu hình PAYROLL_RULES không hợp lệ: " + error.getMessage());
        }
    }
    public record ConfiguredRules(PayrollCalculator.Rules calculationRules, List<Integer> workingWeekdays, Set<LocalDate> publicHolidays) {}

    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
