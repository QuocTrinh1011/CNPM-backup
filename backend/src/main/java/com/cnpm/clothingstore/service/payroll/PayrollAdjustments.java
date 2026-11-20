package com.cnpm.clothingstore.service.payroll;

import com.cnpm.clothingstore.dto.hr.PayrollDtos.*;
import com.cnpm.clothingstore.entity.*;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.*;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.util.*;
import com.cnpm.clothingstore.service.PayrollCalculator;

public final class PayrollAdjustments {
    private static final Set<String> ADJUSTMENT_TYPES = Set.of("EARNING", "BENEFIT", "DEDUCTION", "EMPLOYER_COST");
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    public static PayrollCalculator.Adjustment adjustment(String type, String code, String description, BigDecimal amount) {
        return new PayrollCalculator.Adjustment(normalize(type), code.trim(), description.trim(), amount);
    }

    public static PayrollCalculator.Input appendAdjustment(PayrollCalculator.Input input, PayrollCalculator.Adjustment adjustment) {
        List<PayrollCalculator.Adjustment> all = new ArrayList<>(input.adjustments()); all.add(adjustment);
        return new PayrollCalculator.Input(input.contractedMonthlySalary(), input.insuranceSalaryBase(), input.standardPaidWorkdays(),
                input.paidEquivalentDays(), input.overtimeNormalHours(), input.overtimeRestDayHours(), input.overtimeHolidayHours(),
                input.overtimeNightHours(), input.overtimeNightNormalHours(), input.overtimeNightNormalHoursAfterDaytimeOvertime(),
                input.overtimeNightRestDayHours(), input.overtimeNightHolidayHours(), input.dependentCount(), all);
    }

    public static void validateAdjustment(String type, String code, String description, BigDecimal amount) {
        if (!ADJUSTMENT_TYPES.contains(normalize(type)) || code == null || code.isBlank() || code.length() > 60
                || description == null || description.isBlank() || description.length() > 500 || amount == null || amount.signum() <= 0) {
            throw bad("INVALID_PAYROLL_ADJUSTMENT", "Khoản điều chỉnh cần loại hợp lệ, mã, giải thích và số tiền dương.");
        }
    }

    public static String normalize(String value) { return value == null ? "" : value.trim().toUpperCase(Locale.ROOT); }

    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
