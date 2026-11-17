package com.htttdn.crm.service;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:employeeReports;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
@Transactional
class EmployeeReportIntegrationTest {
    private static final String PASSWORD = "TestPassword123!";
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired MockMvc mvc;

    @Test
    void hrGetsMonthlyStatusEducationSalaryAndTenureAndOtherRolesAreDenied() throws Exception {
        String hrToken = createUserToken("MANAGER_HR", "hr-report");
        long activeId = createEmployee(hrToken, "report-active", "Cao đẳng", "2000000", "2024-01-01");
        long resigningId = createEmployee(hrToken, "report-resigned", "Đại học", "3000000", "2024-01-01");
        createEmployee(hrToken, "report-future", "Đại học", "4000000", "2026-06-01");

        String leave = mvc.perform(post("/api/manager/me/leave-requests").header("Authorization", employeeToken(activeId))
                        .contentType("application/json")
                        .content("{\"requestType\":\"ANNUAL\",\"startDate\":\"2026-05-04\",\"endDate\":\"2026-05-05\",\"employeeNote\":\"Annual leave\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long leaveId = ((Number) com.jayway.jsonpath.JsonPath.read(leave, "$.id")).longValue();
        mvc.perform(patch("/api/manager/hr/leave-requests/" + leaveId + "/decision")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(status().isOk());

        String resignation = mvc.perform(post("/api/manager/me/leave-requests").header("Authorization", employeeToken(resigningId))
                        .contentType("application/json")
                        .content("{\"requestType\":\"RESIGNATION\",\"startDate\":\"2026-05-20\",\"endDate\":\"2026-05-20\",\"employeeNote\":\"Resignation\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long resignationId = ((Number) com.jayway.jsonpath.JsonPath.read(resignation, "$.id")).longValue();
        mvc.perform(patch("/api/manager/hr/leave-requests/" + resignationId + "/decision")
                        .header("Authorization", hrToken).contentType("application/json")
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/manager/hr/reports?year=2026&month=5").header("Authorization", hrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.totalEmployees").value(2))
                .andExpect(jsonPath("$.summary.activeCount").value(1))
                .andExpect(jsonPath("$.summary.onApprovedLeaveCount").value(1))
                .andExpect(jsonPath("$.summary.resignedInPeriodCount").value(1))
                .andExpect(jsonPath("$.salarySummary.totalMonthlyBaseSalary").value(5000000.0))
                .andExpect(jsonPath("$.educationSummary.length()").value(2))
                .andExpect(jsonPath("$.employees[0].employeeId").value(activeId))
                .andExpect(jsonPath("$.employees[0].approvedLeaveTypes[0]").value("ANNUAL"))
                .andExpect(jsonPath("$.employees[0].tenureMonths").value(28))
                .andExpect(jsonPath("$.employees[1].employeeId").value(resigningId))
                .andExpect(jsonPath("$.employees[1].employmentStatus").value("RESIGNED"))
                .andExpect(jsonPath("$.employees[1].resignedInPeriod").value(true));
        mvc.perform(get("/api/manager/hr/reports?year=2026&month=5").header("Authorization", employeeToken(activeId)))
                .andExpect(status().isForbidden());
    }

    private long createEmployee(String hrToken, String prefix, String education, String salary, String hireDate) throws Exception {
        String email = prefix + "-" + UUID.randomUUID() + "@hr.test";
        String body = "{\"fullName\":\"" + prefix + "\",\"email\":\"" + email
                + "\",\"phone\":\"0901234567\",\"temporaryPassword\":\"StrongPass123!\",\"employeeCode\":\"R-"
                + UUID.randomUUID() + "\",\"educationLevel\":\"" + education + "\",\"jobTitle\":\"Nhân viên\","
                + "\"permissionProfile\":\"STAFF\",\"hireDate\":\"" + hireDate + "\",\"monthlyBaseSalary\":" + salary
                + ",\"insuranceSalaryBase\":" + salary + ",\"reportsToEmployeeId\":null}";
        String response = mvc.perform(post("/api/manager/employees").header("Authorization", hrToken)
                        .contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
    }

    private String createUserToken(String role, String prefix) {
        User user = new User(); user.setEmail(prefix + "-" + UUID.randomUUID() + "@hr.test");
        user.setFullName(prefix); user.setPasswordHash(encoder.encode(PASSWORD)); user.setRole(role);
        users.saveAndFlush(user); return "Bearer " + managerAuth.login(user.getEmail(), PASSWORD).accessToken();
    }

    private String employeeToken(long id) {
        User user = users.findById(id).orElseThrow();
        return "Bearer " + managerAuth.login(user.getEmail(), "StrongPass123!").accessToken();
    }
}
