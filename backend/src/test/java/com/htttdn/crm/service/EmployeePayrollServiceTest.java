package com.htttdn.crm.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EmployeePayrollServiceTest {
    private final PayrollCalculator calculator = new PayrollCalculator();

    @Test
    void rejectsZeroStandardWorkdays() {
        assertThrows(IllegalArgumentException.class,
                () -> calculator.calculate(input("10000000", "0", "0", "0", "0", "0", "0", "0", 0, List.of()), rules()));
    }

    @Test
    void doesNotCreateNegativeTakeHomeWhenThereAreNoPaidDays() {
        var result = calculator.calculate(input("0", "1000000", "20", "0", "0", "0", "0", "0", 0, List.of()),
                rules("8", "1.5", "2", "3", "0.3", "0.10", "0.20", "0", "0", zeroTaxBrackets()));

        assertMoney("0.00", result.employeeDeductions());
        assertMoney("0.00", result.takeHomePay());
    }

    @Test
    void proratesMonthlyBaseByPaidEquivalentHalfDays() {
        var result = calculator.calculate(input("100000", "0", "2", "0.5", "0", "0", "0", "0", 0, List.of()),
                rules("8", "1", "1", "1", "0", "0", "0", "0", "0", zeroTaxBrackets()));

        assertMoney("25000.00", result.proratedBase());
        assertMoney("25000.00", result.takeHomePay());
    }

    @Test
    void appliesEachConfiguredOvertimeMultiplier() {
        var result = calculator.calculate(input("10000000", "0", "20", "20", "2", "1", "1", "1", 0, List.of()),
                rules("8", "1.5", "2", "3", "0.3", "0", "0", "0", "0", zeroTaxBrackets()));

        assertMoney("10000000.00", result.proratedBase());
        assertMoney("518750.00", result.overtimePay());
        assertMoney("10518750.00", result.takeHomePay());
    }

    @Test
    void appliesNightOvertimePremiumsForNormalRestAndHolidayDays() {
        var input = new PayrollCalculator.Input(money("2000000"), money("0"), money("20"), money("0"),
                money("2"), money("0"), money("0"), money("0"), money("1"), money("1"),
                money("1"), money("1"), 0, List.of());
        var result = calculator.calculate(input,
                rules("8", "1.5", "2", "3", "0.3", "0", "0", "0", "0", zeroTaxBrackets()));

        assertMoney("146250.00", result.overtimePay());
        assertMoney("26250.00", result.lines().stream().filter(line -> line.code().equals("OVERTIME_NIGHT_NORMAL"))
                .findFirst().orElseThrow().amount());
        assertMoney("33750.00", result.lines().stream().filter(line -> line.code().equals("OVERTIME_NIGHT_REST_DAY"))
                .findFirst().orElseThrow().amount());
        assertMoney("48750.00", result.lines().stream().filter(line -> line.code().equals("OVERTIME_NIGHT_HOLIDAY"))
                .findFirst().orElseThrow().amount());
    }

    @Test
    void normalNightOvertimeWithoutDaytimeOvertimeUsesOneHundredPercentForAdditionalPremiumBasis() {
        var input = new PayrollCalculator.Input(money("2000000"), money("0"), money("20"), money("0"),
                money("0"), money("0"), money("0"), money("0"), money("1"), money("0"),
                money("0"), money("0"), 0, List.of());
        var result = calculator.calculate(input,
                rules("8", "1.5", "2", "3", "0.3", "0", "0", "0", "0", zeroTaxBrackets()));

        assertMoney("25000.00", result.overtimePay());
    }

    @Test
    void appliesThe2026MonthlyTaxBandsAndInsuranceBases() {
        List<PayrollCalculator.TaxBracket> taxBands = List.of(
                new PayrollCalculator.TaxBracket(money("0"), money("10000000"), money("0.05")),
                new PayrollCalculator.TaxBracket(money("10000000"), money("30000000"), money("0.10")),
                new PayrollCalculator.TaxBracket(money("30000000"), money("60000000"), money("0.20")),
                new PayrollCalculator.TaxBracket(money("60000000"), money("100000000"), money("0.30")),
                new PayrollCalculator.TaxBracket(money("100000000"), null, money("0.35")));
        var result = calculator.calculate(input("60000000", "20000000", "20", "20", "0", "0", "0", "0", 0, List.of()),
                new PayrollCalculator.Rules(money("8"), money("1.5"), money("2"), money("3"), money("0.3"),
                        money("0.2"), money("0.105"), money("0.215"), money("15500000"), money("6200000"), taxBands));

        assertMoney("2100000.00", result.employeeInsurance());
        assertMoney("4980000.00", result.personalIncomeTax());
        assertMoney("4300000.00", result.employerContributions());
        assertMoney("52920000.00", result.takeHomePay());
    }

    @Test
    void rejectsNightOvertimeAdditionalRateOutsideFractionRange() {
        var invalidRules = new PayrollCalculator.Rules(money("8"), money("1.5"), money("2"), money("3"), money("0.3"),
                money("1.1"), money("0.105"), money("0.215"), money("15500000"), money("6200000"), zeroTaxBrackets());

        assertThrows(IllegalArgumentException.class,
                () -> calculator.calculate(input("10000000", "10000000", "20", "20", "0", "0", "0", "0", 0, List.of()), invalidRules));
    }

    @Test
    void computesInsuranceProgressiveTaxBenefitsAndDeductionsSeparately() {
        List<PayrollCalculator.TaxBracket> brackets = List.of(
                new PayrollCalculator.TaxBracket(new BigDecimal("0"), new BigDecimal("50000"), new BigDecimal("0.05")),
                new PayrollCalculator.TaxBracket(new BigDecimal("50000"), null, new BigDecimal("0.10")));
        List<PayrollCalculator.Adjustment> adjustments = List.of(
                new PayrollCalculator.Adjustment("BENEFIT", "SICK_BENEFIT", "Sick leave benefit", new BigDecimal("10000")),
                new PayrollCalculator.Adjustment("DEDUCTION", "ADVANCE_REPAYMENT", "Advance repayment", new BigDecimal("1000")));
        var result = calculator.calculate(input("100000", "50000", "20", "20", "0", "0", "0", "0", 0, adjustments),
                rules("8", "1", "1", "1", "0", "0.10", "0.20", "10000", "0", brackets));

        assertMoney("5000.00", result.employeeInsurance());
        assertMoney("6000.00", result.personalIncomeTax());
        assertMoney("10000.00", result.separateBenefits());
        assertMoney("12000.00", result.employeeDeductions());
        assertMoney("10000.00", result.employerContributions());
        assertMoney("98000.00", result.takeHomePay());
    }

    @Test
    void roundsCurrencyToTwoDecimalPlacesHalfUp() {
        var result = calculator.calculate(input("1", "0", "3", "1", "0", "0", "0", "0", 0, List.of()),
                rules("8", "1", "1", "1", "0", "0", "0", "0", "0", zeroTaxBrackets()));

        assertMoney("0.33", result.proratedBase());
    }

    @Test
    void rejectsOverlappingOrGappedTaxBrackets() {
        var invalidRules = rules("8", "1", "1", "1", "0", "0", "0", "0", "0", List.of(
                new PayrollCalculator.TaxBracket(new BigDecimal("0"), new BigDecimal("50000"), new BigDecimal("0.05")),
                new PayrollCalculator.TaxBracket(new BigDecimal("40000"), null, new BigDecimal("0.10"))));

        assertThrows(IllegalArgumentException.class,
                () -> calculator.calculate(input("100000", "0", "20", "20", "0", "0", "0", "0", 0, List.of()), invalidRules));
    }

    @Test
    void rejectsEmptyTaxBracketSchedule() {
        var emptyTaxRules = new PayrollCalculator.Rules(money("8"), money("1"), money("1"), money("1"),
                money("0"), money("0"), money("0"), money("0"), money("0"), List.of());

        assertThrows(IllegalArgumentException.class,
                () -> calculator.calculate(input("100000", "0", "20", "20", "0", "0", "0", "0", 0, List.of()), emptyTaxRules));
    }

    private static PayrollCalculator.Input input(String salary, String insuranceBase, String workdays,
                                                 String paidDays, String normal, String rest, String holiday,
                                                 String night, int dependents, List<PayrollCalculator.Adjustment> adjustments) {
        return new PayrollCalculator.Input(money(salary), money(insuranceBase), money(workdays), money(paidDays),
                money(normal), money(rest), money(holiday), money(night), dependents, adjustments);
    }

    private static PayrollCalculator.Rules rules() {
        return rules("8", "1", "1", "1", "0", "0", "0", "0", "0", zeroTaxBrackets());
    }

    private static List<PayrollCalculator.TaxBracket> zeroTaxBrackets() {
        return List.of(new PayrollCalculator.TaxBracket(BigDecimal.ZERO, null, BigDecimal.ZERO));
    }

    private static PayrollCalculator.Rules rules(String hoursPerWorkday, String normal, String rest, String holiday,
                                                  String night, String employeeInsurance, String employerContribution,
                                                  String personalAllowance, String dependentAllowance,
                                                  List<PayrollCalculator.TaxBracket> brackets) {
        return new PayrollCalculator.Rules(money(hoursPerWorkday), money(normal), money(rest), money(holiday), money(night),
                money(employeeInsurance), money(employerContribution), money(personalAllowance), money(dependentAllowance), brackets);
    }

    private static BigDecimal money(String value) { return new BigDecimal(value); }
    private static void assertMoney(String expected, BigDecimal actual) { assertEquals(money(expected), actual); }
}
