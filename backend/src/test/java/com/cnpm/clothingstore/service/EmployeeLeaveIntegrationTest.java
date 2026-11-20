package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.repository.EmployeeProfileRepository;
import com.cnpm.clothingstore.repository.AuditLogRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:employeeLeave;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
@Transactional
class EmployeeLeaveIntegrationTest {
    private static final String PASSWORD = "TestPassword123!";

    @Autowired UserRepository users;
    @Autowired EmployeeProfileRepository profiles;
    @Autowired AuditLogRepository auditLogs;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired MockMvc mvc;

    @Test
    void employeesCanViewAndWithdrawOnlyTheirOwnPendingRequests() throws Exception {
        String hrToken = hrToken();
        long firstId = createEmployee(hrToken, "leave-first");
        long secondId = createEmployee(hrToken, "leave-second");
        String firstToken = employeeToken(firstId);
        String secondToken = employeeToken(secondId);

        String response = mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", firstToken)
                        .contentType("application/json")
                        .content(leaveJson("ANNUAL", "2026-12-01", "2026-12-02")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.requestType").value("ANNUAL"))
                .andReturn().getResponse().getContentAsString();
        long requestId = ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();

        mvc.perform(get("/api/manager/me/leave-requests?employeeId=" + secondId)
                        .header("Authorization", firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].employeeId").value(firstId));
        mvc.perform(get("/api/manager/me/leave-requests").header("Authorization", secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));

        mvc.perform(patch("/api/manager/me/leave-requests/" + requestId + "/withdraw")
                        .header("Authorization", secondToken))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/manager/me/leave-requests/" + requestId + "/withdraw")
                        .header("Authorization", firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        mvc.perform(patch("/api/manager/me/leave-requests/" + requestId + "/withdraw")
                        .header("Authorization", firstToken))
                .andExpect(status().isConflict());
    }

    @Test
    void validatesRequestTypeDateRangeAndOverlappingPendingRequests() throws Exception {
        String hrToken = hrToken();
        long employeeId = createEmployee(hrToken, "leave-validation");
        String token = employeeToken(employeeId);

        mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", token).contentType("application/json")
                        .content(leaveJson("ANNUAL", "2026-12-05", "2026-12-01")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", token).contentType("application/json")
                        .content(leaveJson("UNSUPPORTED", "2026-12-01", "2026-12-01")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", token).contentType("application/json")
                        .content(leaveJson("ANNUAL", "2026-12-01", "2026-12-03")))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", token).contentType("application/json")
                        .content(leaveJson("SICK", "2026-12-03", "2026-12-04")))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", token).contentType("application/json")
                        .content(leaveJson("SICK", "2026-12-04", "2026-12-05")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.requestType").value("SICK"));
        mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", token).contentType("application/json")
                        .content(leaveJson("MATERNITY", "2026-12-06", "2026-12-07")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.requestType").value("MATERNITY"));
        mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", token).contentType("application/json")
                        .content(leaveJson("RESIGNATION", "2024-12-31", "2024-12-31")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void hrCanApproveRejectAndRecordApprovedResignationWithoutDeletingHistory() throws Exception {
        String hrToken = hrToken();
        long employeeId = createEmployee(hrToken, "leave-decision");
        String employeeToken = employeeToken(employeeId);
        long annualRequest = createLeave(employeeToken, "ANNUAL", "2026-12-01", "2026-12-02");
        long resignationRequest = createLeave(employeeToken, "RESIGNATION", "2026-12-31", "2026-12-31");

        mvc.perform(get("/api/manager/hr/leave-requests?status=PENDING")
                        .header("Authorization", hrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2));

        mvc.perform(patch("/api/manager/hr/leave-requests/" + annualRequest + "/decision")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content("{\"decision\":\"REJECTED\",\"reviewerNote\":\"Không thể duyệt kỳ này\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.reviewerNote").value("Không thể duyệt kỳ này"));
        mvc.perform(patch("/api/manager/hr/leave-requests/" + annualRequest + "/decision")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(status().isConflict());

        mvc.perform(patch("/api/manager/hr/leave-requests/" + resignationRequest + "/decision")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content("{\"decision\":\"APPROVED\",\"reviewerNote\":\"Ngày nghỉ theo đơn\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
        var decisionAudit = auditLogs.findAll().stream()
                .filter(log -> "EMPLOYEE_LEAVE_REQUEST".equals(log.getEntityType())
                        && resignationRequest == log.getTargetId() && "DECIDE".equals(log.getAction()))
                .findFirst().orElseThrow();
        assertEquals("DECIDE", decisionAudit.getAction());
        org.junit.jupiter.api.Assertions.assertFalse(decisionAudit.getAfterData().contains("reviewerNote"));
        EmployeeProfile profile = profiles.findById(employeeId).orElseThrow();
        assertEquals("RESIGNED", profile.getEmploymentStatus());
        assertEquals(java.time.LocalDate.parse("2026-12-31"), profile.getResignationDate());
        assertNotNull(profile.getEmployeeCode());
    }

    @Test
    void approvingResignationRevokesEmployeeSessionAndBlocksExistingSelfServiceToken() throws Exception {
        String hrToken = hrToken();
        long employeeId = createEmployee(hrToken, "leave-offboard");
        User employee = users.findById(employeeId).orElseThrow();
        ManagerAuthService.Session session = managerAuth.login(employee.getEmail(), "StrongPass123!");
        String employeeToken = bearer(session.accessToken());
        long resignationId = createLeave(employeeToken, "RESIGNATION", "2026-12-31", "2026-12-31");

        mvc.perform(patch("/api/manager/hr/leave-requests/" + resignationId + "/decision")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(status().isOk());

        org.junit.jupiter.api.Assertions.assertThrows(com.cnpm.clothingstore.exception.ApiException.class,
                () -> managerAuth.refresh(session.refreshToken()));
        mvc.perform(get("/api/manager/me/profile").header("Authorization", employeeToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void employeesCannotAccessHrDecisionQueue() throws Exception {
        String hrToken = hrToken();
        long employeeId = createEmployee(hrToken, "leave-role-boundary");
        mvc.perform(get("/api/manager/hr/leave-requests").header("Authorization", employeeToken(employeeId)))
                .andExpect(status().isForbidden());
    }

    private long createEmployee(String hrToken, String prefix) throws Exception {
        String email = prefix + "-" + UUID.randomUUID() + "@hr.test";
        String response = mvc.perform(post("/api/manager/employees")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content(employeeJson(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
    }

    private long createLeave(String employeeToken, String type, String start, String end) throws Exception {
        String response = mvc.perform(post("/api/manager/me/leave-requests")
                        .header("Authorization", employeeToken).contentType("application/json")
                        .content(leaveJson(type, start, end)))
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

    private static String employeeJson(String email) {
        return """
                {"fullName":"Leave Test","email":"%s","phone":"0901234567",
                 "temporaryPassword":"StrongPass123!","employeeCode":"L-%s",
                 "jobTitle":"Nhân viên","permissionProfile":"STAFF","hireDate":"2025-01-15",
                 "monthlyBaseSalary":10000000,"insuranceSalaryBase":9000000}
                """.formatted(email, UUID.randomUUID());
    }

    private static String leaveJson(String type, String start, String end) {
        return """
                {"requestType":"%s","startDate":"%s","endDate":"%s","employeeNote":"Yêu cầu nghỉ"}
                """.formatted(type, start, end);
    }

    private static String bearer(String token) { return "Bearer " + token; }
}
