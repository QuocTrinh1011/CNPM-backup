package com.htttdn.crm.dto.hr;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class PayrollDtos {
    private PayrollDtos() {}

    public record SettingRequest(String settingKey, LocalDate effectiveFrom, LocalDate effectiveTo,
                                 JsonNode settingValue, String note) {}
    public record SettingView(Long id, String settingKey, LocalDate effectiveFrom, LocalDate effectiveTo,
                              JsonNode settingValue, String note) {}
    public record PeriodRequest(Integer year, Integer month, BigDecimal standardPaidWorkdays,
                                Map<Long, Integer> dependentCounts) {}
    public record AdjustmentRequest(Long employeeId, String lineType, String code, String description,
                                    BigDecimal amount) {}
    public record CorrectionRequest(String lineType, String code, String description, BigDecimal amount) {}
    public record LineView(Long id, String lineType, String code, String description, BigDecimal quantity,
                           BigDecimal rate, BigDecimal amount, int displayOrder) {}
    public record PayslipView(Long id, Long employeeId, String employeeCode, String employeeName,
                              int year, int month, int revision, String status,
                              BigDecimal contractedMonthlySalary, BigDecimal insuranceSalaryBase,
                              BigDecimal paidEquivalentDays, BigDecimal grossEarnings, BigDecimal separateBenefits,
                              BigDecimal employeeDeductions, BigDecimal employerContributions,
                              BigDecimal takeHomePay, BigDecimal uncollectedDeductions,
                              JsonNode sourceSnapshot, List<LineView> lines,
                              Instant createdAt, Instant publishedAt) {}
    public record PeriodView(Long id, int year, int month, BigDecimal standardPaidWorkdays, String status,
                             Instant createdAt, Instant reviewedAt, Instant publishedAt,
                             List<PayslipView> payslips) {}
}
