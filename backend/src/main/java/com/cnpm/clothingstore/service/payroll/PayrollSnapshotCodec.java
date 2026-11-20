package com.cnpm.clothingstore.service.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cnpm.clothingstore.dto.hr.PayrollDtos.*;
import com.cnpm.clothingstore.entity.*;
import com.cnpm.clothingstore.repository.*;
import java.math.BigDecimal;
import java.util.*;
import com.cnpm.clothingstore.service.PayrollCalculator;
import com.cnpm.clothingstore.service.payroll.PayrollRulesParser.ConfiguredRules;
import static com.cnpm.clothingstore.service.payroll.PayrollJsonNumbers.*;
import static com.cnpm.clothingstore.service.payroll.PayrollAdjustments.*;

public final class PayrollSnapshotCodec {
    private final ObjectMapper mapper;
    public PayrollSnapshotCodec(ObjectMapper mapper) { this.mapper = mapper; }
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    public JsonNode sourceSnapshot(EmployeeProfile employee, PayrollCalculator.Input input, JsonNode rules, List<EmployeeAttendance> attendanceRows,
                                    List<EmployeeLeaveRequest> approvedLeaves, ConfiguredRules configured) {
        Map<String, Object> snapshot = new LinkedHashMap<>(); snapshot.put("rules", rules.deepCopy());
        snapshot.put("employeeName", employee.getAccount().getFullName()); snapshot.put("employeeCode", employee.getEmployeeCode());
        snapshot.put("hireDate", employee.getHireDate()); snapshot.put("resignationDate", employee.getResignationDate());
        snapshot.put("input", inputSnapshot(input)); snapshot.put("workingWeekdays", configured.workingWeekdays());
        snapshot.put("publicHolidays", configured.publicHolidays()); snapshot.put("rounding", "HALF_UP_2_DECIMALS");
        snapshot.put("attendance", attendanceRows.stream().map(row -> Map.ofEntries(
                Map.entry("date", row.getAttendanceDate()), Map.entry("status", row.getAttendanceStatus()),
                Map.entry("dayFraction", row.getDayFraction()), Map.entry("paidEquivalentDays", row.getPaidEquivalentDays()),
                Map.entry("overtimeNormalHours", row.getOvertimeNormalHours()), Map.entry("overtimeRestDayHours", row.getOvertimeRestDayHours()),
                Map.entry("overtimeHolidayHours", row.getOvertimeHolidayHours()), Map.entry("overtimeNightHours", row.getOvertimeNightHours()),
                Map.entry("overtimeNightNormalHours", row.getOvertimeNightNormalHours()),
                Map.entry("overtimeNightRestDayHours", row.getOvertimeNightRestDayHours()),
                Map.entry("overtimeNightHolidayHours", row.getOvertimeNightHolidayHours()))).toList());
        snapshot.put("approvedLeave", approvedLeaves.stream().map(row -> Map.of("type", row.getRequestType(), "startDate", row.getStartDate(), "endDate", row.getEndDate(), "status", row.getStatus())).toList());
        return mapper.valueToTree(snapshot);
    }

    public JsonNode inputSnapshot(PayrollCalculator.Input input) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("contractedMonthlySalary", input.contractedMonthlySalary().toPlainString());
        data.put("insuranceSalaryBase", input.insuranceSalaryBase().toPlainString());
        data.put("standardPaidWorkdays", input.standardPaidWorkdays().toPlainString());
        data.put("paidEquivalentDays", input.paidEquivalentDays().toPlainString());
        data.put("overtimeNormalHours", input.overtimeNormalHours().toPlainString()); data.put("overtimeRestDayHours", input.overtimeRestDayHours().toPlainString());
        data.put("overtimeHolidayHours", input.overtimeHolidayHours().toPlainString()); data.put("overtimeNightHours", input.overtimeNightHours().toPlainString());
        data.put("overtimeNightNormalHours", input.overtimeNightNormalHours().toPlainString());
        data.put("overtimeNightNormalHoursAfterDaytimeOvertime", input.overtimeNightNormalHoursAfterDaytimeOvertime().toPlainString());
        data.put("overtimeNightRestDayHours", input.overtimeNightRestDayHours().toPlainString());
        data.put("overtimeNightHolidayHours", input.overtimeNightHolidayHours().toPlainString());
        data.put("dependentCount", input.dependentCount()); data.put("adjustments", input.adjustments().stream().map(adjustment -> Map.of(
                "lineType", adjustment.lineType(), "code", adjustment.code(), "description", adjustment.description(), "amount", adjustment.amount().toPlainString())).toList());
        return mapper.valueToTree(data);
    }

    public PayrollCalculator.Input readInput(JsonNode node) {
        List<PayrollCalculator.Adjustment> adjustments = new ArrayList<>();
        node.path("adjustments").forEach(row -> adjustments.add(adjustment(row.path("lineType").asText(), row.path("code").asText(),
                row.path("description").asText(), decimal(row, "amount"))));
        return new PayrollCalculator.Input(decimal(node, "contractedMonthlySalary"), decimal(node, "insuranceSalaryBase"),
                decimal(node, "standardPaidWorkdays"), decimal(node, "paidEquivalentDays"), decimal(node, "overtimeNormalHours"),
                decimal(node, "overtimeRestDayHours"), decimal(node, "overtimeHolidayHours"), decimal(node, "overtimeNightHours"),
                decimalOrZero(node, "overtimeNightNormalHours"), decimalOrZero(node, "overtimeNightNormalHoursAfterDaytimeOvertime"),
                decimalOrZero(node, "overtimeNightRestDayHours"), decimalOrZero(node, "overtimeNightHolidayHours"),
                node.path("dependentCount").asInt(0), adjustments);
    }
}
