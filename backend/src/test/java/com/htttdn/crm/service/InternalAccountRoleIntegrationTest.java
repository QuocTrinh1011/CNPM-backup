package com.htttdn.crm.service;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.repository.UserRepository;
import com.htttdn.crm.security.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:internalAccountRoles;MODE=PostgreSQL;DB_CLOSE_DELAY=-1","spring.datasource.driver-class-name=org.h2.Driver","spring.datasource.username=sa","spring.datasource.password=","spring.jpa.database-platform=org.hibernate.dialect.H2Dialect","spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
@Transactional
class InternalAccountRoleIntegrationTest {
    private static final String PASSWORD = "StrongPass123!";

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtTokenService jwt;
    @Autowired InternalAccountService accounts;
    @Autowired ManagerAuthService managerAuth;

    @Test
    void adminCanCreateAndListAllRolesAndEmployeeCannotAuthenticate() throws Exception {
        User admin = user("Admin", "ADMIN", PASSWORD);
        String adminToken = bearer(admin);

        for (String role : new String[]{"MANAGER_HR", "MANAGER_WAREHOUSE", "MANAGER_SALES"}) {
            mvc.perform(post("/api/admin/accounts").header("Authorization", adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"fullName\":\"" + role + "\",\"email\":\"" + email(role) + "\",\"role\":\"" + role + "\",\"password\":\"" + PASSWORD + "\"}"))
                    .andExpect(status().isCreated());
        }
        String employeeEmail = email("employee");
        mvc.perform(post("/api/admin/accounts").header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Directory employee\",\"email\":\"" + employeeEmail + "\",\"role\":\"EMPLOYEE\",\"password\":\"x\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        User employee = users.findByEmailIgnoreCase(employeeEmail).orElseThrow();
        assertEquals("EMPLOYEE", employee.getRole());
        assertFalse(encoder.matches("x", employee.getPasswordHash()));

        mvc.perform(get("/api/admin/accounts").header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(5));
        mvc.perform(get("/api/admin/overview").header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accounts").value(5));

        String login = "{\"email\":\"" + employeeEmail + "\",\"password\":\"x\"}";
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(login)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/manager/auth/login").contentType(MediaType.APPLICATION_JSON).content(login)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/auth/login").contentType(MediaType.APPLICATION_JSON).content(login)).andExpect(status().isUnauthorized());
    }

    @Test
    void adminAccountGroupsFilterManagersEmployeesAndCustomersSeparately() throws Exception {
        User admin = user("System admin", "ADMIN", PASSWORD);
        user("Sales manager", "MANAGER_SALES", PASSWORD);
        user("Directory employee", "EMPLOYEE", PASSWORD);
        user("Store customer", "CUSTOMER", PASSWORD);
        String adminToken = bearer(admin);

        mvc.perform(get("/api/admin/accounts").header("Authorization", adminToken).param("group", "managers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].role").value(org.hamcrest.Matchers.containsInAnyOrder("ADMIN", "MANAGER_SALES")));
        mvc.perform(get("/api/admin/accounts").header("Authorization", adminToken).param("group", "employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].role").value("EMPLOYEE"));
        mvc.perform(get("/api/admin/accounts").header("Authorization", adminToken).param("group", "customers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].role").value("CUSTOMER"));
    }

    @Test
    void employeePromotionRequiresNewPassword() throws Exception {
        User employee = accounts.create(new InternalAccountService.Input("Directory employee", email("promote"), "EMPLOYEE", PASSWORD, false));
        User admin = user("Admin", "ADMIN", PASSWORD);

        mvc.perform(patch("/api/admin/accounts/" + employee.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Directory employee\",\"email\":\"" + employee.getEmail() + "\",\"role\":\"MANAGER_SALES\",\"locked\":false}"))
                .andExpect(status().is4xxClientError());

        mvc.perform(patch("/api/admin/accounts/" + employee.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Directory employee\",\"email\":\"" + employee.getEmail() + "\",\"role\":\"MANAGER_SALES\",\"password\":\"NewPass123!\",\"locked\":false}"))
                .andExpect(status().isOk());
        assertTrue(encoder.matches("NewPass123!", users.findById(employee.getId()).orElseThrow().getPasswordHash()));
    }

    @Test
    void accountChangesPreserveSelfAndLastAdminProtection() {
        User admin = user("Only admin", "ADMIN", PASSWORD);
        String ownToken = bearer(admin);

        assertThrows(com.htttdn.crm.exception.ApiException.class, () -> accounts.update(admin.getId(),
                new InternalAccountService.Input(admin.getFullName(), admin.getEmail(), "MANAGER_SALES", null, false), ownToken));
        assertThrows(com.htttdn.crm.exception.ApiException.class, () -> accounts.update(admin.getId(),
                new InternalAccountService.Input(admin.getFullName(), admin.getEmail(), "ADMIN", null, true), ownToken));
        assertThrows(com.htttdn.crm.exception.ApiException.class, () -> accounts.delete(admin.getId(), ownToken));

        User manager = user("Sales manager", "MANAGER_SALES", PASSWORD);
        assertThrows(com.htttdn.crm.exception.ApiException.class, () -> accounts.update(admin.getId(),
                new InternalAccountService.Input(admin.getFullName(), admin.getEmail(), "ADMIN", null, true), bearer(manager)));
        assertEquals("ADMIN", users.findById(admin.getId()).orElseThrow().getRole());
        assertFalse(users.findById(admin.getId()).orElseThrow().isLocked());
    }

    @Test
    void roleChangeRevokesRefreshSessionAndHrCanManageEmployeeProfiles() throws Exception {
        User sales = accounts.create(new InternalAccountService.Input("Sales manager", email("sales"), "MANAGER_SALES", PASSWORD, false));
        var session = managerAuth.login(sales.getEmail(), PASSWORD);
        accounts.update(sales.getId(), new InternalAccountService.Input("Sales manager", sales.getEmail(), "MANAGER_WAREHOUSE", null, false), bearer(user("Admin", "ADMIN", PASSWORD)));
        assertThrows(com.htttdn.crm.exception.ApiException.class, () -> managerAuth.refresh(session.refreshToken()));

        User hr = user("HR manager", "MANAGER_HR", PASSWORD);
        String hrToken = bearer(hr);
        String employeeAEmail = email("employee-a");
        long employeeAId = createEmployee(hrToken, "A Directory employee", employeeAEmail);
        createEmployee(hrToken, "B Directory employee", email("employee-b"));
        long deletedEmployeeId = createEmployee(hrToken, "Deleted employee", email("deleted"));
        mvc.perform(delete("/api/manager/employees/" + deletedEmployeeId).header("Authorization", hrToken))
                .andExpect(status().isNoContent());
        user("Matching customer", "CUSTOMER", PASSWORD);

        mvc.perform(get("/api/manager/employees").header("Authorization", hrToken).param("q", "Directory").param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content.length()").value(1));
        mvc.perform(get("/api/manager/employees").header("Authorization", hrToken).param("q", "A Directory employee"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(employeeAId))
                .andExpect(jsonPath("$.content[0].fullName").value("A Directory employee"))
                .andExpect(jsonPath("$.content[0].email").value(employeeAEmail))
                .andExpect(jsonPath("$.content[0].locked").value(false))
                .andExpect(jsonPath("$.content[0].age").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.content[0].preferences").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.content[0].lockReason").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.content[0].deletedAt").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.content[0].createdAt").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.content[0].role").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotHaveJsonPath());
        mvc.perform(get("/api/manager/employees").header("Authorization", bearer(sales)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/manager/orders").header("Authorization", bearer(hr)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/manager/employees").header("Authorization", bearer(sales)).contentType(MediaType.APPLICATION_JSON)
                        .content(employeeJson(email("sales-create"), "Sales employee", "SALES-" + UUID.randomUUID())))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/manager/employees/" + employeeAId).header("Authorization", bearer(sales)))
                .andExpect(status().isForbidden());
        assertTrue(users.findById(employeeAId).isPresent());
        assertTrue(users.findById(deletedEmployeeId).orElseThrow().getDeletedAt() != null);
    }

    private long createEmployee(String hrToken, String fullName, String employeeEmail) throws Exception {
        String response = mvc.perform(post("/api/manager/employees").header("Authorization", hrToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(employeeJson(employeeEmail, fullName, "HR-" + UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
    }

    private String employeeJson(String employeeEmail, String fullName, String employeeCode) {
        return """
                {"fullName":"%s","email":"%s","phone":"0901234567",
                 "temporaryPassword":"StrongPass123!","employeeCode":"%s","educationLevel":"Cao đẳng",
                 "jobTitle":"Nhân viên bán hàng","permissionProfile":"STAFF",
                 "hireDate":"2025-01-15","monthlyBaseSalary":12000000,
                 "insuranceSalaryBase":10000000}
                """.formatted(fullName, employeeEmail, employeeCode);
    }

    private User user(String name, String role, String password) {
        User user = new User();
        user.setFullName(name);
        user.setEmail(email(name));
        user.setRole(role);
        user.setPasswordHash(encoder.encode(password));
        return users.saveAndFlush(user);
    }

    private String bearer(User user) {
        return "Bearer " + jwt.issue(user.getId(), user.getRole());
    }

    private String email(String suffix) {
        return UUID.randomUUID() + "." + suffix.toLowerCase().replaceAll("[^a-z0-9]", "") + "@roles.test";
    }
}
