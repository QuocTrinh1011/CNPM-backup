package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.repository.EmployeeProfileRepository;
import com.cnpm.clothingstore.repository.RefreshTokenRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:managerEmployees;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
@Transactional
class ManagerEmployeeIntegrationTest {
    private static final String PASSWORD = "TestPassword123!";

    @Autowired UserRepository users;
    @Autowired EmployeeProfileRepository profiles;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired MockMvc mvc;
    @PersistenceContext EntityManager entityManager;

    @Test
    void hrCanCreateListUpdateAndDeactivateEmployeeWithoutDeletingProfile() throws Exception {
        String hrToken = hrToken();
        String email = email("created-employee");
        String createBody = employeeJson(email, "HR-" + UUID.randomUUID(), "StrongPass123!");

        String created = mvc.perform(post("/api/manager/employees")
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.jobTitle").value("Nhân viên bán hàng"))
                .andExpect(jsonPath("$.workArea").value("GENERAL"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.temporaryPassword").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        long employeeId = ((Number) com.jayway.jsonpath.JsonPath.read(created, "$.id")).longValue();
        User employee = users.findByEmailIgnoreCase(email).orElseThrow();
        assertTrue(encoder.matches("StrongPass123!", employee.getPasswordHash()));
        String employeeRefreshToken = managerAuth.login(email, "StrongPass123!").refreshToken();

        mvc.perform(get("/api/manager/employees?q=" + email)
                        .header("Authorization", hrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(employeeId));

        mvc.perform(put("/api/manager/employees/" + employeeId)
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content("""
                                {"phone":"0912345678","jobTitle":"Trưởng nhóm bán hàng",
                                 "permissionProfile":"TEAM_LEAD","monthlyBaseSalary":18000000,
                                 "insuranceSalaryBase":15000000}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissionProfile").value("TEAM_LEAD"))
                .andExpect(jsonPath("$.monthlyBaseSalary").value(18000000));

        mvc.perform(delete("/api/manager/employees/" + employeeId)
                        .header("Authorization", hrToken))
                .andExpect(status().isNoContent());
        User deactivated = users.findById(employeeId).orElseThrow();
        assertNotNull(deactivated.getDeletedAt());
        assertTrue(deactivated.isLocked());
        assertTrue(profiles.existsById(employeeId));
        entityManager.clear();
        assertThrows(com.cnpm.clothingstore.exception.ApiException.class,
                () -> managerAuth.refresh(employeeRefreshToken));
        assertEquals("REVOKED", refreshTokens.findForUpdate(AuthService.hash(employeeRefreshToken))
                .orElseThrow().getStatus());
        mvc.perform(get("/api/manager/employees?q=" + email)
                        .header("Authorization", hrToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void hrCannotCreateDuplicateEmailOrEmployeeCode() throws Exception {
        String hrToken = hrToken();
        String email = email("duplicate");
        String employeeCode = "DUP-" + UUID.randomUUID();
        mvc.perform(post("/api/manager/employees")
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content(employeeJson(email, employeeCode, "StrongPass123!")))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/manager/employees")
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content(employeeJson(email, "O-" + UUID.randomUUID(), "StrongPass123!")))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/manager/employees")
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content(employeeJson(email("other"), employeeCode, "StrongPass123!")))
                .andExpect(status().isConflict());
    }

    @Test
    void hrCanAssignAndClearEmployeeWorkArea() throws Exception {
        String hrToken = hrToken();
        String email = email("warehouse-employee");
        String body = employeeJson(email, "W-" + UUID.randomUUID(), "StrongPass123!")
                .replace("\"hireDate\"", "\"workArea\":\"WAREHOUSE\",\"hireDate\"");

        String created = mvc.perform(post("/api/manager/employees")
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.workArea").value("WAREHOUSE"))
                .andReturn().getResponse().getContentAsString();
        long employeeId = ((Number) com.jayway.jsonpath.JsonPath.read(created, "$.id")).longValue();

        mvc.perform(put("/api/manager/employees/" + employeeId)
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content("{\"workArea\":\"GENERAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workArea").value("GENERAL"));
        assertEquals("GENERAL", profiles.findById(employeeId).orElseThrow().getWorkArea());
    }

    @Test
    void hrCannotAssignUnknownWorkArea() throws Exception {
        String hrToken = hrToken();
        String email = email("invalid-work-area");
        String body = employeeJson(email, "W-" + UUID.randomUUID(), "StrongPass123!")
                .replace("\"hireDate\"", "\"workArea\":\"OFFICE\",\"hireDate\"");

        mvc.perform(post("/api/manager/employees")
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isBadRequest());
        assertTrue(users.findByEmailIgnoreCase(email).isEmpty());
    }

    @Test
    void offboardingRevokesRefreshSessionAndBlocksExistingSelfServiceToken() throws Exception {
        String hrToken = hrToken();
        String email = email("offboarded");
        long employeeId = createEmployee(hrToken, email, "O-" + UUID.randomUUID().toString().substring(0, 8));
        ManagerAuthService.Session employeeSession = managerAuth.login(email, "StrongPass123!");

        mvc.perform(put("/api/manager/employees/" + employeeId)
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content("{\"employmentStatus\":\"TERMINATED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employmentStatus").value("TERMINATED"));

        assertThrows(com.cnpm.clothingstore.exception.ApiException.class,
                () -> managerAuth.refresh(employeeSession.refreshToken()));
        assertThrows(com.cnpm.clothingstore.exception.ApiException.class,
                () -> managerAuth.login(email, "StrongPass123!"));
        mvc.perform(get("/api/manager/me/profile").header("Authorization", "Bearer " + employeeSession.accessToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    void employeeReadsAndEditsOnlyOwnContactFields() throws Exception {
        String hrToken = hrToken();
        String firstEmail = email("self-one");
        String secondEmail = email("self-two");
        long firstId = createEmployee(hrToken, firstEmail, "S-" + UUID.randomUUID());
        long secondId = createEmployee(hrToken, secondEmail, "S-" + UUID.randomUUID());
        String firstToken = bearer(managerAuth.login(firstEmail, "StrongPass123!").accessToken());
        String secondToken = bearer(managerAuth.login(secondEmail, "StrongPass123!").accessToken());

        mvc.perform(get("/api/manager/me/profile?employeeId=" + secondId)
                        .header("Authorization", firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstId))
                .andExpect(jsonPath("$.email").value(firstEmail));

        mvc.perform(put("/api/manager/me/profile")
                        .header("Authorization", firstToken)
                        .contentType("application/json")
                        .content("""
                                {"phone":"0987654321","emergencyContactName":"Người thân",
                                 "emergencyContactPhone":"0900000000","monthlyBaseSalary":1,
                                 "workArea":"WAREHOUSE"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("0987654321"))
                .andExpect(jsonPath("$.workArea").value("GENERAL"))
                .andExpect(jsonPath("$.monthlyBaseSalary").value(12000000));

        mvc.perform(get("/api/manager/me/profile").header("Authorization", secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(secondId))
                .andExpect(jsonPath("$.phone").value("0901234567"));

        mvc.perform(get("/api/manager/employees").header("Authorization", firstToken))
                .andExpect(status().isForbidden());
    }

    private long createEmployee(String hrToken, String email, String code) throws Exception {
        String response = mvc.perform(post("/api/manager/employees")
                        .header("Authorization", hrToken)
                        .contentType("application/json")
                        .content(employeeJson(email, code, "StrongPass123!")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
    }

    private String hrToken() {
        User hr = new User();
        hr.setEmail(email("hr"));
        hr.setFullName("HR Manager");
        hr.setPasswordHash(encoder.encode(PASSWORD));
        hr.setRole("MANAGER_HR");
        users.saveAndFlush(hr);
        return bearer(managerAuth.login(hr.getEmail(), PASSWORD).accessToken());
    }

    private static String employeeJson(String email, String employeeCode, String password) {
        return """
                {"fullName":"Employee Test","email":"%s","phone":"0901234567",
                 "temporaryPassword":"%s","employeeCode":"%s","educationLevel":"Cao đẳng",
                 "jobTitle":"Nhân viên bán hàng","permissionProfile":"STAFF",
                 "hireDate":"2025-01-15","monthlyBaseSalary":12000000,
                 "insuranceSalaryBase":10000000}
                """.formatted(email, password, employeeCode);
    }

    private static String email(String prefix) { return prefix + "-" + UUID.randomUUID() + "@hr.test"; }
    private static String bearer(String token) { return "Bearer " + token; }
}
