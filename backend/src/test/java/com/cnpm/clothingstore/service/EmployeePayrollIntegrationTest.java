package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.entity.EmployeeAttendance;
import com.cnpm.clothingstore.repository.EmployeeAttendanceRepository;
import com.cnpm.clothingstore.repository.EmployeeProfileRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:employeePayroll;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
@Transactional
class EmployeePayrollIntegrationTest {
    private static final String PASSWORD = "TestPassword123!";

    @Autowired UserRepository users;
    @Autowired EmployeeProfileRepository profiles;
    @Autowired EmployeeAttendanceRepository attendance;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired MockMvc mvc;

    @Test
    void hrGeneratesReviewsAndPublishesPayrollAndEmployeeSeesOnlyOwnPublishedPayslip() throws Exception {
        String hrToken = hrToken();
        long employeeId = createEmployee(hrToken, "payroll-first", "STAFF", null, "2000000", "1000000");
        long otherEmployeeId = createEmployee(hrToken, "payroll-second", "STAFF", null, "3000000", "1500000");
        String employeeToken = employeeToken(employeeId);
        String otherEmployeeToken = employeeToken(otherEmployeeId);
        saveRules(hrToken, "2026-01-01", "0.10");
        saveRules(hrToken, "2026-06-01", "0.20");

        mvc.perform(put("/api/manager/hr/attendance").header("Authorization", hrToken).contentType("application/json")
                        .content(attendanceJson(employeeId, "2026-05-04", "WORKED", "1", "1", "2", "1", "0", "0")))
                .andExpect(status().isOk());
        mvc.perform(put("/api/manager/hr/attendance").header("Authorization", hrToken).contentType("application/json")
                        .content(attendanceJson(employeeId, "2026-05-05", "UNPAID_LEAVE", "1", "0", "0")))
                .andExpect(status().isOk());
        String leaveResponse = mvc.perform(post("/api/manager/me/leave-requests").header("Authorization", employeeToken)
                        .contentType("application/json").content("""
                                {"requestType":"ANNUAL","startDate":"2026-05-06","endDate":"2026-05-06","employeeNote":"Annual leave"}
                                """))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long leaveId = ((Number) com.jayway.jsonpath.JsonPath.read(leaveResponse, "$.id")).longValue();
        mvc.perform(patch("/api/manager/hr/leave-requests/" + leaveId + "/decision")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/manager/hr/payroll-settings?asOf=2026-05-01").header("Authorization", hrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effectiveFrom").value("2026-01-01"));
        String periodJson = """
                {"year":2026,"month":5,"standardPaidWorkdays":20,"dependentCounts":{"%d":0,"%d":0}}
                """.formatted(employeeId, otherEmployeeId);
        String periodResponse = mvc.perform(post("/api/manager/hr/payroll-periods").header("Authorization", hrToken)
                        .contentType("application/json").content(periodJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.payslips.length()").value(2))
                .andExpect(jsonPath("$.payslips[?(@.employeeId == " + employeeId + ")].paidEquivalentDays").value(2))
                .andExpect(jsonPath("$.payslips[?(@.employeeId == " + employeeId + ")].grossEarnings").value(263750.0))
                .andExpect(jsonPath("$.payslips[?(@.employeeId == " + employeeId + ")].sourceSnapshot.input.overtimeNightNormalHours").value("1"))
                .andExpect(jsonPath("$.payslips[?(@.employeeId == " + employeeId + ")].sourceSnapshot.input.overtimeNightNormalHoursAfterDaytimeOvertime").value("1"))
                .andReturn().getResponse().getContentAsString();

        mvc.perform(get("/api/manager/me/payslips/2026/5").header("Authorization", employeeToken))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/manager/hr/payroll-periods/2026/5/adjustments").header("Authorization", hrToken)
                        .contentType("application/json")
                        .content("{\"employeeId\":" + employeeId + ",\"lineType\":\"EARNING\",\"code\":\"BONUS\",\"description\":\"Thưởng hiệu suất\",\"amount\":10000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grossEarnings").value(273750.0))
                .andExpect(jsonPath("$.takeHomePay").value(173750.0));
        mvc.perform(post("/api/manager/hr/payroll-periods/2026/5/review").header("Authorization", hrToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVIEWED"));
        mvc.perform(post("/api/manager/hr/payroll-periods/2026/5/publish").header("Authorization", hrToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"));

        mvc.perform(put("/api/manager/hr/attendance").header("Authorization", hrToken).contentType("application/json")
                        .content(attendanceJson(employeeId, "2026-05-04", "WORKED", "1", "0", "0")))
                .andExpect(status().isOk());
        User renamedAfterPublish = users.findById(employeeId).orElseThrow();
        renamedAfterPublish.setFullName("Updated live profile name");
        users.saveAndFlush(renamedAfterPublish);

        mvc.perform(get("/api/manager/me/payslips/2026/5").header("Authorization", employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeId").value(employeeId))
                .andExpect(jsonPath("$.employeeName").value("Payroll Test"))
                .andExpect(jsonPath("$.paidEquivalentDays").value(2))
                .andExpect(jsonPath("$.takeHomePay").value(173750.0))
                .andExpect(jsonPath("$.sourceSnapshot.approvedLeave.length()").value(1));
        mvc.perform(get("/api/manager/me/payslips?year=2026").header("Authorization", employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].employeeId").value(employeeId));
        mvc.perform(get("/api/manager/me/payslips/2026/5").header("Authorization", otherEmployeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeId").value(otherEmployeeId))
                .andExpect(jsonPath("$.sourceSnapshot.approvedLeave.length()").value(0))
                .andExpect(jsonPath("$.takeHomePay").value(0.0))
                .andExpect(jsonPath("$.uncollectedDeductions").value(150000.0));
        mvc.perform(post("/api/manager/hr/payroll-periods").header("Authorization", hrToken)
                        .contentType("application/json").content(periodJson))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/manager/hr/payroll-periods/2026/5/revisions/" + employeeId)
                        .header("Authorization", hrToken).contentType("application/json")
                        .content("""
                                {"lineType":"EARNING","code":"BONUS","description":"Điều chỉnh thưởng đã duyệt","amount":10000}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.revision").value(2))
                .andExpect(jsonPath("$.takeHomePay").value(183750.0));
        mvc.perform(get("/api/manager/me/payslips/2026/5").header("Authorization", employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision").value(2))
                .andExpect(jsonPath("$.takeHomePay").value(183750.0));

        mvc.perform(get("/api/manager/me/payslips/2026/5").header("Authorization", hrToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/manager/hr/payroll-periods/2026/5").header("Authorization", employeeToken))
                .andExpect(status().isForbidden());
        org.junit.jupiter.api.Assertions.assertNotNull(periodResponse);
    }

    @Test
    void teamLeadsCannotReadPayrollAndSettingsRequireEffectiveDates() throws Exception {
        String hrToken = hrToken();
        long leadId = createEmployee(hrToken, "payroll-lead", "TEAM_LEAD", null, "2000000", "1000000");
        String leadToken = employeeToken(leadId);
        mvc.perform(get("/api/manager/hr/payroll-periods").header("Authorization", leadToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/manager/me/payslips?year=2026").header("Authorization", leadToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

        mvc.perform(put("/api/manager/hr/payroll-settings").header("Authorization", hrToken)
                        .contentType("application/json").content("{\"settingKey\":\"PAYROLL_RULES\",\"effectiveFrom\":\"2026-01-01\",\"settingValue\":{}}"))
                .andExpect(status().isBadRequest());

        String emptyTaxRules = """
                {"hoursPerWorkday":8,"normalOvertimeMultiplier":1.5,"restDayOvertimeMultiplier":2,
                 "holidayOvertimeMultiplier":3,"nightWorkPremiumMultiplier":0.3,"employeeInsuranceRate":0.1,
                 "employerContributionRate":0.2,"personalTaxAllowance":0,"dependentTaxAllowance":0,
                 "workingWeekdays":[1,2,3,4,5],"publicHolidays":[],"taxBrackets":[]}
                """;
        mvc.perform(put("/api/manager/hr/payroll-settings").header("Authorization", hrToken)
                        .contentType("application/json")
                        .content("""
                                {"settingKey":"PAYROLL_RULES","effectiveFrom":"2026-01-01","settingValue":%s}
                                """.formatted(emptyTaxRules)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PAYROLL_RULES"));
    }

    @Test
    void refusesToGenerateWhenPayrollRulesChangeMidMonth() throws Exception {
        String hrToken = hrToken();
        saveRules(hrToken, "2026-01-01", "0.10");
        saveRules(hrToken, "2026-05-15", "0.20");

        mvc.perform(post("/api/manager/hr/payroll-periods").header("Authorization", hrToken)
                        .contentType("application/json")
                        .content("{\"year\":2026,\"month\":5,\"standardPaidWorkdays\":20,\"dependentCounts\":{}}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_RULE_CHANGE_WITHIN_PERIOD"));
    }

    @Test
    void refusesPayrollWhenUnpaidOrAbsentAttendanceContainsPaidDays() throws Exception {
        String hrToken = hrToken();
        long employeeId = createEmployee(hrToken, "payroll-invalid-days", "STAFF", null, "2000000", "1000000");
        saveRules(hrToken, "2026-01-01", "0.10");
        for (var row : new Object[][]{
                {"2026-05-04", "UNPAID_LEAVE"},
                {"2026-05-05", "ABSENT"}
        }) {
            EmployeeAttendance invalid = new EmployeeAttendance();
            invalid.setEmployee(profiles.findById(employeeId).orElseThrow());
            invalid.setAttendanceDate(LocalDate.parse((String) row[0]));
            invalid.setAttendanceStatus((String) row[1]);
            invalid.setDayFraction(BigDecimal.ONE);
            invalid.setPaidEquivalentDays(BigDecimal.ONE);
            attendance.saveAndFlush(invalid);
        }

        mvc.perform(post("/api/manager/hr/payroll-periods").header("Authorization", hrToken)
                        .contentType("application/json")
                        .content("{\"year\":2026,\"month\":5,\"standardPaidWorkdays\":20,\"dependentCounts\":{}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PAYROLL_ATTENDANCE"));
    }

    private void saveRules(String hrToken, String effectiveFrom, String employeeRate) throws Exception {
        String rules = """
                {"hoursPerWorkday":8,"normalOvertimeMultiplier":1.5,"restDayOvertimeMultiplier":2,
                 "holidayOvertimeMultiplier":3,"nightWorkPremiumMultiplier":0.3,"nightOvertimeAdditionalMultiplier":0.2,"employeeInsuranceRate":%s,
                 "employerContributionRate":0.2,"personalTaxAllowance":0,"dependentTaxAllowance":0,
                 "workingWeekdays":[1,2,3,4,5],"publicHolidays":[],"taxBrackets":[{"lowerBound":0,"upperBound":null,"rate":0}]}
                """.formatted(employeeRate);
        mvc.perform(put("/api/manager/hr/payroll-settings").header("Authorization", hrToken)
                        .contentType("application/json")
                        .content("""
                                {"settingKey":"PAYROLL_RULES","effectiveFrom":"%s","settingValue":%s,"note":"Test effective payroll rules"}
                                """.formatted(effectiveFrom, rules)))
                .andExpect(status().isCreated());
    }

    private long createEmployee(String hrToken, String prefix, String profile, Long reportsTo,
                                String salary, String insuranceBase) throws Exception {
        String email = prefix + "-" + UUID.randomUUID() + "@hr.test";
        String response = mvc.perform(post("/api/manager/employees").header("Authorization", hrToken)
                        .contentType("application/json").content(employeeJson(email, profile, reportsTo, salary, insuranceBase)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
    }

    private String hrToken() {
        User hr = new User();
        hr.setEmail("hr-" + UUID.randomUUID() + "@hr.test");
        hr.setFullName("HR Manager");
        hr.setPasswordHash(encoder.encode(PASSWORD));
        hr.setRole("MANAGER_HR");
        users.saveAndFlush(hr);
        return bearer(managerAuth.login(hr.getEmail(), PASSWORD).accessToken());
    }

    private String employeeToken(long employeeId) {
        User employee = users.findById(employeeId).orElseThrow();
        return bearer(managerAuth.login(employee.getEmail(), "StrongPass123!").accessToken());
    }

    private static String employeeJson(String email, String profile, Long reportsTo, String salary, String insuranceBase) {
        return """
                {"fullName":"Payroll Test","email":"%s","phone":"0901234567",
                 "temporaryPassword":"StrongPass123!","employeeCode":"P-%s","jobTitle":"Nhân viên",
                 "permissionProfile":"%s","hireDate":"2025-01-15","monthlyBaseSalary":%s,
                 "insuranceSalaryBase":%s,"reportsToEmployeeId":%s}
                """.formatted(email, UUID.randomUUID(), profile, salary, insuranceBase,
                reportsTo == null ? "null" : reportsTo.toString());
    }

    private static String attendanceJson(long employeeId, String date, String status, String dayFraction,
                                         String paidDays, String overtimeHours) {
        return attendanceJson(employeeId, date, status, dayFraction, paidDays, overtimeHours, "0", "0", "0");
    }

    private static String attendanceJson(long employeeId, String date, String status, String dayFraction,
                                         String paidDays, String overtimeHours, String nightNormal,
                                         String nightRestDay, String nightHoliday) {
        return """
                {"employeeId":%d,"attendanceDate":"%s","attendanceStatus":"%s","dayFraction":%s,
                 "paidEquivalentDays":%s,"overtimeNormalHours":%s,"overtimeRestDayHours":0,
                 "overtimeHolidayHours":0,"overtimeNightHours":0,"overtimeNightNormalHours":%s,
                 "overtimeNightRestDayHours":%s,"overtimeNightHolidayHours":%s}
                """.formatted(employeeId, date, status, dayFraction, paidDays, overtimeHours,
                nightNormal, nightRestDay, nightHoliday);
    }

    private static String bearer(String token) { return "Bearer " + token; }
}
