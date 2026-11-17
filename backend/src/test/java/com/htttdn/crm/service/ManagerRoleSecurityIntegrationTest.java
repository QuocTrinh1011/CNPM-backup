package com.htttdn.crm.service;

import com.htttdn.crm.entity.Category;
import com.htttdn.crm.entity.Product;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.repository.EmployeeProfileRepository;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.CategoryRepository;
import com.htttdn.crm.repository.ProductRepository;
import com.htttdn.crm.repository.RefreshTokenRepository;
import com.htttdn.crm.repository.UserRepository;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:managerRoleSecurity;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
@Transactional
class ManagerRoleSecurityIntegrationTest {
    private static final String PASSWORD = "TestPassword123!";

    @Autowired UserRepository users;
    @Autowired EmployeeProfileRepository employeeProfiles;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired CategoryRepository categories;
    @Autowired ProductRepository products;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired JwtTokenService jwt;
    @Autowired MockMvc mvc;
    @PersistenceContext EntityManager entityManager;

    @Test
    void eachManagerRoleGetsItsOwnLoginRefreshAudienceAndJwtClaim() {
        for (String role : new String[]{"MANAGER_HR", "MANAGER_WAREHOUSE", "MANAGER_SALES"}) {
            User user = account(role);

            ManagerAuthService.Session login = assertDoesNotThrow(() -> managerAuth.login(user.getEmail(), PASSWORD));
            assertEquals(role, jwt.parse("Bearer " + login.accessToken()).role());
            assertEquals(role, refreshTokens.findForUpdate(AuthService.hash(login.refreshToken())).orElseThrow().getAudience());

            ManagerAuthService.Session refreshed = managerAuth.refresh(login.refreshToken());
            assertEquals(role, jwt.parse("Bearer " + refreshed.accessToken()).role());
            assertEquals(role, refreshTokens.findForUpdate(AuthService.hash(refreshed.refreshToken())).orElseThrow().getAudience());
        }
    }

    @Test
    void employeeCanLoginRefreshChangePasswordAndLogoutInTheManagerSession() throws Exception {
        User employee = account("EMPLOYEE");
        ManagerAuthService.Session login = managerAuth.login(employee.getEmail(), PASSWORD);

        assertEquals("EMPLOYEE", jwt.parse("Bearer " + login.accessToken()).role());
        assertEquals("EMPLOYEE", refreshTokens.findForUpdate(AuthService.hash(login.refreshToken()))
                .orElseThrow().getAudience());

        ManagerAuthService.Session refreshed = managerAuth.refresh(login.refreshToken());
        assertEquals("EMPLOYEE", jwt.parse("Bearer " + refreshed.accessToken()).role());

        mvc.perform(post("/api/manager/auth/change-password")
                        .header("Authorization", "Bearer " + refreshed.accessToken())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"EmployeePassword456!\"}"))
                .andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();
        assertDoesNotThrow(() -> managerAuth.login(employee.getEmail(), "EmployeePassword456!"));
        assertThrows(ApiException.class, () -> managerAuth.refresh(refreshed.refreshToken()));

        ManagerAuthService.Session current = managerAuth.login(employee.getEmail(), "EmployeePassword456!");
        managerAuth.logout(current.refreshToken());
        assertEquals("REVOKED", refreshTokens.findForUpdate(AuthService.hash(current.refreshToken()))
                .orElseThrow().getStatus());
    }

    @Test
    void employeeRoleChangeRevokesOldRefreshSession() {
        User employee = account("EMPLOYEE");
        ManagerAuthService.Session session = managerAuth.login(employee.getEmail(), PASSWORD);
        employee.setRole("MANAGER_SALES");
        users.saveAndFlush(employee);

        assertThrows(ApiException.class, () -> managerAuth.refresh(session.refreshToken()));
        assertEquals("REVOKED", refreshTokens.findForUpdate(AuthService.hash(session.refreshToken()))
                .orElseThrow().getStatus());
    }

    @Test
    void employeeLoginRejectsLockedAndDeactivatedAccounts() {
        User locked = account("EMPLOYEE");
        locked.setLocked(true);
        users.saveAndFlush(locked);
        assertThrows(ApiException.class, () -> managerAuth.login(locked.getEmail(), PASSWORD));

        User deactivated = account("EMPLOYEE");
        deactivated.setDeletedAt(java.time.Instant.now());
        users.saveAndFlush(deactivated);
        assertThrows(ApiException.class, () -> managerAuth.login(deactivated.getEmail(), PASSWORD));
    }

    @Test
    void employeeSelfServicePathPassesTheManagerGuard() throws Exception {
        User employee = account("EMPLOYEE");
        String token = "Bearer " + managerAuth.login(employee.getEmail(), PASSWORD).accessToken();

        mvc.perform(get("/api/manager/me/profile").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(employee.getId()));
    }

    @Test
    void changingRoleInvalidatesPreviouslyIssuedAccessAndRefreshTokens() throws Exception {
        User user = account("MANAGER_SALES");
        ManagerAuthService.Session session = managerAuth.login(user.getEmail(), PASSWORD);

        user.setRole("MANAGER_WAREHOUSE");
        users.saveAndFlush(user);

        mvc.perform(get("/api/manager/products/1").header("Authorization", "Bearer " + session.accessToken()))
                .andExpect(status().isForbidden());
        assertThrows(ApiException.class, () -> managerAuth.refresh(session.refreshToken()));
    }

    @Test
    void eachManagerRoleCanChangeItsPasswordAndOldRefreshSessionIsRevoked() throws Exception {
        for (String role : new String[]{"MANAGER_HR", "MANAGER_WAREHOUSE", "MANAGER_SALES"}) {
            User user = account(role);
            ManagerAuthService.Session oldSession = managerAuth.login(user.getEmail(), PASSWORD);

            mvc.perform(post("/api/manager/auth/change-password")
                            .header("Authorization", "Bearer " + oldSession.accessToken())
                            .contentType("application/json")
                            .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"NewPassword456!\"}"))
                    .andExpect(status().isNoContent());

            entityManager.flush();
            entityManager.clear();
            assertDoesNotThrow(() -> managerAuth.login(user.getEmail(), "NewPassword456!"));
            assertThrows(ApiException.class, () -> managerAuth.refresh(oldSession.refreshToken()));
        }
    }

    @Test
    void salesCanReadProductButCannotChangeStockWhileWarehouseCan() throws Exception {
        Category category = new Category();
        category.setName("Role boundary " + UUID.randomUUID());
        category = categories.saveAndFlush(category);
        Product product = new Product();
        product.setName("Role boundary product");
        product.setCategoryEntity(category);
        product.setPrice(new BigDecimal("100000"));
        product.setStock(4);
        product = products.saveAndFlush(product);

        User sales = account("MANAGER_SALES");
        User warehouse = account("MANAGER_WAREHOUSE");
        User hr = account("MANAGER_HR");
        String salesToken = "Bearer " + managerAuth.login(sales.getEmail(), PASSWORD).accessToken();
        String warehouseToken = "Bearer " + managerAuth.login(warehouse.getEmail(), PASSWORD).accessToken();
        String hrToken = "Bearer " + managerAuth.login(hr.getEmail(), PASSWORD).accessToken();

        mvc.perform(get("/api/manager/products/" + product.getId()).header("Authorization", salesToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(product.getId()));
        mvc.perform(get("/api/manager/products/" + product.getId()).header("Authorization", warehouseToken))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/manager/products/" + product.getId() + "/stock")
                        .header("Authorization", salesToken).contentType("application/json").content("{\"quantity\":8}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/manager/products/" + product.getId() + "/stock")
                        .header("Authorization", warehouseToken).contentType("application/json").content("{\"quantity\":8}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/manager/products/" + product.getId()).header("Authorization", hrToken))
                .andExpect(status().isForbidden());
        assertEquals(8, products.findById(product.getId()).orElseThrow().getStock());
    }

    @Test
    void deniesUnknownManagerRoutesToAuthenticatedManagers() throws Exception {
        User sales = account("MANAGER_SALES");
        String token = "Bearer " + managerAuth.login(sales.getEmail(), PASSWORD).accessToken();

        mvc.perform(get("/api/manager/not-a-real-endpoint").header("Authorization", token))
                .andExpect(status().isForbidden());
    }

    private User account(String role) {
        User user = new User();
        user.setFullName(role);
        user.setEmail(UUID.randomUUID() + "@manager-role.test");
        user.setPasswordHash(encoder.encode(PASSWORD));
        user.setRole(role);
        User saved = users.saveAndFlush(user);
        if ("EMPLOYEE".equals(role)) {
            EmployeeProfile profile = new EmployeeProfile();
            profile.setEmployeeId(saved.getId());
            profile.setAccount(saved);
            profile.setEmployeeCode("T-" + UUID.randomUUID().toString().substring(0, 8));
            profile.setJobTitle("Nhân viên kiểm thử");
            profile.setEmploymentStatus("ACTIVE");
            profile.setHireDate(LocalDate.of(2025, 1, 1));
            profile.setMonthlyBaseSalary(BigDecimal.ZERO);
            profile.setInsuranceSalaryBase(BigDecimal.ZERO);
            employeeProfiles.saveAndFlush(profile);
        }
        return saved;
    }
}
