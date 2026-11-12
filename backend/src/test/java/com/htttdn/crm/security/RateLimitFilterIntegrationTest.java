package com.htttdn.crm.security;

import com.htttdn.crm.entity.User;
import jakarta.servlet.http.Cookie;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:rateFilterTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1","spring.datasource.driver-class-name=org.h2.Driver","spring.datasource.username=sa","spring.datasource.password=","spring.jpa.database-platform=org.hibernate.dialect.H2Dialect","spring.jpa.hibernate.ddl-auto=create-drop","app.rate-limit.per-minute=1000","app.rate-limit.auth-max-attempts=5","app.rate-limit.auth-window-minutes=15","app.rate-limit.trusted-proxies=10.0.6.1,10.0.6.2,10.0.6.3"})
@AutoConfigureMockMvc @Transactional
class RateLimitFilterIntegrationTest {
    @Autowired EntityManager em; @Autowired MockMvc mvc; @Autowired PasswordEncoder encoder;

    private static final String EMAIL = "customer@rate.test";
    private static final String PASSWORD = "Password123";

    User customer() {
        var u = new User();
        u.setEmail(EMAIL); u.setFullName("Rate Test"); u.setRole("CUSTOMER");
        u.setPasswordHash(encoder.encode(PASSWORD));
        em.persist(u); em.flush(); return u;
    }

    static RequestPostProcessor from(String ip) {
        return request -> { request.setRemoteAddr(ip); return request; };
    }

    @Test void failedLoginsReturn429AfterMaxAttempts() throws Exception {
        customer();
        String body = "{\"email\":\"" + EMAIL + "\",\"password\":\"WrongPass1\"}";
        String url = "/api/auth/login";
        for (int attempt = 0; attempt < 5; attempt++)
            mvc.perform(post(url).with(from("10.0.1.1")).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post(url).with(from("10.0.1.1")).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test void successfulLoginsNeverCountTowardTheLimit() throws Exception {
        customer();
        String good = "{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}";
        String bad = "{\"email\":\"" + EMAIL + "\",\"password\":\"WrongPass1\"}";
        String url = "/api/auth/login";
        mvc.perform(post(url).with(from("10.0.2.1")).contentType(MediaType.APPLICATION_JSON).content(good)).andExpect(status().isOk());
        mvc.perform(post(url).with(from("10.0.2.1")).contentType(MediaType.APPLICATION_JSON).content(good)).andExpect(status().isOk());
        for (int attempt = 0; attempt < 5; attempt++)
            mvc.perform(post(url).with(from("10.0.2.1")).contentType(MediaType.APPLICATION_JSON).content(bad)).andExpect(status().isUnauthorized());
        mvc.perform(post(url).with(from("10.0.2.1")).contentType(MediaType.APPLICATION_JSON).content(bad)).andExpect(status().isTooManyRequests());
    }

    @Test void differentEmailOnSameIpIsNotBlocked() throws Exception {
        String url = "/api/auth/login";
        String a = "{\"email\":\"a@rate.test\",\"password\":\"WrongPass1\"}";
        String b = "{\"email\":\"b@rate.test\",\"password\":\"WrongPass1\"}";
        for (int attempt = 0; attempt < 5; attempt++)
            mvc.perform(post(url).with(from("10.0.3.1")).contentType(MediaType.APPLICATION_JSON).content(a)).andExpect(status().isUnauthorized());
        mvc.perform(post(url).with(from("10.0.3.1")).contentType(MediaType.APPLICATION_JSON).content(a)).andExpect(status().isTooManyRequests());
        mvc.perform(post(url).with(from("10.0.3.1")).contentType(MediaType.APPLICATION_JSON).content(b)).andExpect(status().isUnauthorized());
    }

    @Test void forwardedForCannotBypassFailedLoginLimitFromUntrustedRemoteAddress() throws Exception {
        String url = "/api/auth/login";
        String body = "{\"email\":\"" + EMAIL + "\",\"password\":\"WrongPass1\"}";
        for (int attempt = 1; attempt <= 5; attempt++)
            mvc.perform(post(url).with(from("10.0.7.1")).header("X-Forwarded-For", "198.51.100." + attempt).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized());
        mvc.perform(post(url).with(from("10.0.7.1")).header("X-Forwarded-For", "198.51.100.6").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests());
    }

    @Test void trustedProxyUsesRightmostValidNonTrustedForwardedAddress() throws Exception {
        String url = "/api/auth/login";
        String body = "{\"email\":\"" + EMAIL + "\",\"password\":\"WrongPass1\"}";
        for (int attempt = 1; attempt <= 6; attempt++)
            mvc.perform(post(url).with(from("10.0.6.1")).header("X-Forwarded-For", "192.0.2.250, 198.51.100." + attempt + ", 10.0.6.2, invalid, 10.0.6.3").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized());
    }

    @Test void refreshEndpointIsRateLimitedAndStillAcceptsAValidSession() throws Exception {
        customer();
        String body = "{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}";
        var login = mvc.perform(post("/api/auth/login").with(from("10.0.8.1")).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        Cookie refreshCookie = login.getResponse().getCookie("refreshToken");
        assertNotNull(refreshCookie);
        mvc.perform(post("/api/auth/refresh").with(from("10.0.8.1")).cookie(refreshCookie)).andExpect(status().isOk());

        for (int attempt = 0; attempt < 5; attempt++)
            mvc.perform(post("/api/auth/refresh").with(from("10.0.8.2"))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/refresh").with(from("10.0.8.2"))).andExpect(status().isTooManyRequests());
    }

    @Test void payosWebhookIsExemptFromRateLimiting() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/payments/payos/webhook").with(from("10.0.4.1")).contentType(MediaType.APPLICATION_JSON).content("{\"junk\":true}"))
                    .andExpect(result -> assertNotEquals(429, result.getResponse().getStatus()));
        }
        mvc.perform(get("/api/products").with(from("10.0.4.1"))).andExpect(status().isOk());
    }

    @Test void optionsRequestsAreNeverBlocked() throws Exception {
        for (int i = 0; i < 6; i++) {
            mvc.perform(options("/api/auth/login").with(from("10.0.5.1")))
                    .andExpect(result -> assertNotEquals(429, result.getResponse().getStatus()));
        }
    }
}
