package com.cnpm.clothingstore.security;

import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.service.ManagerAuthService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:lifecycleTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1","spring.datasource.driver-class-name=org.h2.Driver","spring.datasource.username=sa","spring.datasource.password=","spring.jpa.database-platform=org.hibernate.dialect.H2Dialect","spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
@Transactional
class AuthSessionBoundaryIntegrationTest {
    private static final String PASSWORD = "Password123";

    @Autowired EntityManager em;
    @Autowired MockMvc mvc;
    @Autowired ManagerAuthService managerAuth;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtTokenService jwt;

    @Test
    void customerPrivateApiRejectsAnonymousAndStaffTokens() throws Exception {
        User customer = user("CUSTOMER", "customer@auth-boundary.test");
        User manager = user("MANAGER", "manager@auth-boundary.test");
        User admin = user("ADMIN", "admin@auth-boundary.test");

        mvc.perform(get("/api/orders")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/orders").header("Authorization", bearer(manager))).andExpect(status().isForbidden());
        mvc.perform(get("/api/orders").header("Authorization", bearer(admin))).andExpect(status().isForbidden());
        mvc.perform(get("/api/orders").header("Authorization", bearer(customer))).andExpect(status().isOk());
    }

    @Test
    void customerRefreshCannotConsumeManagerRefreshToken() throws Exception {
        String managerRefreshToken = managerSession().refreshToken();

        mvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", managerRefreshToken)))
                .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/manager/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("managerRefreshToken", managerRefreshToken)))
                .andExpect(status().isOk());
    }

    @Test
    void customerLogoutCannotRevokeManagerRefreshToken() throws Exception {
        String managerRefreshToken = managerSession().refreshToken();

        mvc.perform(post("/api/auth/logout")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", managerRefreshToken)))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/manager/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("managerRefreshToken", managerRefreshToken)))
                .andExpect(status().isOk());
    }

    @Test
    void customerRefreshRotatesTokenAndReuseRevokesItsTokenFamily() throws Exception {
        User customer = user("CUSTOMER", "refresh@auth-boundary.test");
        String firstToken = cookieValue(mvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"" + customer.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn(), "refreshToken");

        String rotatedToken = cookieValue(mvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", firstToken)))
                .andExpect(status().isOk())
                .andReturn(), "refreshToken");
        assertNotEquals(firstToken, rotatedToken);

        mvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", firstToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_REUSE_DETECTED"));
        em.clear();
        mvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", rotatedToken)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void customerLogoutRevokesThatCustomerRefreshToken() throws Exception {
        User customer = user("CUSTOMER", "logout@auth-boundary.test");
        String refreshToken = cookieValue(mvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"" + customer.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn(), "refreshToken");

        mvc.perform(post("/api/auth/logout")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", refreshToken)))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", refreshToken)))
                .andExpect(status().isUnauthorized());
    }

    private ManagerAuthService.Session managerSession() {
        User manager = user("MANAGER_SALES", "manager@auth-boundary.test");
        return managerAuth.login(manager.getEmail(), PASSWORD);
    }

    private User user(String role, String email) {
        User user = new User();
        user.setEmail(email);
        user.setFullName("Auth Boundary " + role);
        user.setRole(role);
        user.setPasswordHash(encoder.encode(PASSWORD));
        em.persist(user);
        em.flush();
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + jwt.issue(user.getId(), user.getRole());
    }

    private String cookieValue(MvcResult result, String name) {
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertNotNull(setCookie);
        assertTrue(setCookie.contains("HttpOnly"));
        String prefix = name + "=";
        int start = setCookie.indexOf(prefix);
        assertTrue(start >= 0);
        start += prefix.length();
        int end = setCookie.indexOf(';', start);
        return setCookie.substring(start, end < 0 ? setCookie.length() : end);
    }
}
