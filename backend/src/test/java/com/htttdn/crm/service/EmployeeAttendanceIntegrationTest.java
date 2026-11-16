package com.htttdn.crm.service;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.repository.AuditLogRepository;
import com.htttdn.crm.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:employeeAttendance;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
@Transactional
class EmployeeAttendanceIntegrationTest {
    private static final String PASSWORD = "TestPassword123!";

    @Autowired UserRepository users;
    @Autowired AuditLogRepository auditLogs;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired MockMvc mvc;

    @Test
    void hrCanUpsertAttendanceAndEmployeesCanReadOnlyTheirOwnMonth() throws Exception {
        String hrToken = hrToken();
        long firstId = createEmployee(hrToken, "attendance-first", "STAFF", null);
        long secondId = createEmployee(hrToken, "attendance-second", "STAFF", null);

        String created = mvc.perform(put("/api/manager/hr/attendance")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content(attendanceJson(firstId, "2026-05-04", "WORKED", "0.5", "0.5", "0", "0", "0", "0")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dayFraction").value(0.5))
                .andReturn().getResponse().getContentAsString();
        long attendanceId = ((Number) com.jayway.jsonpath.JsonPath.read(created, "$.id")).longValue();
        mvc.perform(put("/api/manager/hr/attendance")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content(attendanceJson(firstId, "2026-05-04", "WORKED", "0.5", "0.5", "2", "0", "0", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overtimeNormalHours").value(2))
                .andExpect(jsonPath("$.overtimeNightHours").value(1));
        assertEquals(2, auditLogs.findAll().stream()
                .filter(log -> "EMPLOYEE_ATTENDANCE".equals(log.getEntityType())
                        && attendanceId == log.getTargetId()
                        && Set.of("CREATE", "UPDATE").contains(log.getAction()))
                .count());
        mvc.perform(put("/api/manager/hr/attendance")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content(attendanceJson(secondId, "2026-05-04", "ABSENT", "1", "0", "0", "0", "0", "0")))
                .andExpect(status().isOk());

        mvc.perform(get("/api/manager/hr/attendance?year=2026&month=5&employeeId=" + firstId)
                        .header("Authorization", hrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].employeeId").value(firstId));

        String employeeToken = employeeToken(firstId);
        mvc.perform(get("/api/manager/me/attendance?year=2026&month=5&employeeId=" + secondId)
                        .header("Authorization", employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].employeeId").value(firstId))
                .andExpect(jsonPath("$[0].overtimeNormalHours").value(2));
        mvc.perform(get("/api/manager/me/attendance?year=2026&month=6")
                        .header("Authorization", employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(put("/api/manager/hr/attendance")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content(attendanceJson(firstId, "2026-05-05", "WORKED", "0.25", "0.25", "0", "0", "0", "0")))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/manager/hr/attendance")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content(attendanceJson(firstId, "2026-05-05", "UNKNOWN", "1", "1", "0", "0", "0", "0")))
                .andExpect(status().isBadRequest());
        for (String attendanceStatus : new String[]{"UNPAID_LEAVE", "ABSENT"}) {
            mvc.perform(put("/api/manager/hr/attendance")
                            .header("Authorization", hrToken).contentType("application/json")
                            .content(attendanceJson(firstId, attendanceStatus.equals("ABSENT") ? "2026-05-07" : "2026-05-06",
                                    attendanceStatus, "1", "1", "0", "0", "0", "0")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_PAID_DAYS"));
        }
        mvc.perform(get("/api/manager/me/attendance?year=1999&month=5").header("Authorization", employeeToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void teamLeadsCanReadOnlyAssignedBasicProfilesAndAttendance() throws Exception {
        String hrToken = hrToken();
        long leadId = createEmployee(hrToken, "attendance-lead", "TEAM_LEAD", null);
        long reportOne = createEmployee(hrToken, "attendance-report-one", "STAFF", leadId);
        long reportTwo = createEmployee(hrToken, "attendance-report-two", "STAFF", leadId);
        long unrelated = createEmployee(hrToken, "attendance-unrelated", "STAFF", null);
        String leadToken = employeeToken(leadId);

        for (long employeeId : new long[]{reportOne, reportTwo, unrelated}) {
            mvc.perform(put("/api/manager/hr/attendance")
                            .header("Authorization", hrToken).contentType("application/json")
                            .content(attendanceJson(employeeId, "2026-05-04", "WORKED", "1", "1", "2", "0", "0", "1")))
                    .andExpect(status().isOk());
        }

        String teamResponse = mvc.perform(get("/api/manager/me/team").header("Authorization", leadToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].monthlyBaseSalary").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        var teamIds = com.jayway.jsonpath.JsonPath.<java.util.List<Integer>>read(teamResponse, "$[*].employeeId");
        assertEquals(2, teamIds.size());
        org.junit.jupiter.api.Assertions.assertTrue(teamIds.contains(Math.toIntExact(reportOne)));
        org.junit.jupiter.api.Assertions.assertTrue(teamIds.contains(Math.toIntExact(reportTwo)));

        String attendanceResponse = mvc.perform(get("/api/manager/me/team/attendance?year=2026&month=5")
                        .header("Authorization", leadToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].overtimeNormalHours").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        var attendanceIds = com.jayway.jsonpath.JsonPath.<java.util.List<Integer>>read(attendanceResponse, "$[*].employeeId");
        assertEquals(2, attendanceIds.size());
        org.junit.jupiter.api.Assertions.assertFalse(attendanceIds.contains(Math.toIntExact(unrelated)));

        mvc.perform(get("/api/manager/me/team").header("Authorization", employeeToken(reportOne)))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/manager/hr/attendance").header("Authorization", leadToken)
                        .contentType("application/json")
                        .content(attendanceJson(reportOne, "2026-05-06", "WORKED", "1", "1", "0", "0", "0", "0")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/manager/hr/payroll-periods").header("Authorization", leadToken))
                .andExpect(status().isForbidden());
    }

    private long createEmployee(String hrToken, String prefix, String profile, Long reportsTo) throws Exception {
        String email = prefix + "-" + UUID.randomUUID() + "@hr.test";
        String response = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/manager/employees")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content(employeeJson(email, profile, reportsTo)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
    }

    private String employeeToken(long employeeId) {
        User employee = users.findById(employeeId).orElseThrow();
        return bearer(managerAuth.login(employee.getEmail(), "StrongPass123!").accessToken());
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

    private static String employeeJson(String email, String profile, Long reportsTo) {
        return """
                {"fullName":"Attendance Test","email":"%s","phone":"0901234567",
                 "temporaryPassword":"StrongPass123!","employeeCode":"A-%s",
                 "jobTitle":"Nhân viên","permissionProfile":"%s","hireDate":"2025-01-15",
                 "monthlyBaseSalary":10000000,"insuranceSalaryBase":9000000,"reportsToEmployeeId":%s}
                """.formatted(email, UUID.randomUUID(), profile, reportsTo == null ? "null" : reportsTo.toString());
    }

    private static String attendanceJson(long employeeId, String date, String status, String fraction,
                                         String paid, String normal, String rest, String holiday, String night) {
        return """
                {"employeeId":%d,"attendanceDate":"%s","attendanceStatus":"%s",
                 "dayFraction":%s,"paidEquivalentDays":%s,"overtimeNormalHours":%s,
                 "overtimeRestDayHours":%s,"overtimeHolidayHours":%s,"overtimeNightHours":%s,
                 "note":"Kiểm thử"}
                """.formatted(employeeId, date, status, fraction, paid, normal, rest, holiday, night);
    }

    private static String bearer(String token) { return "Bearer " + token; }
}
