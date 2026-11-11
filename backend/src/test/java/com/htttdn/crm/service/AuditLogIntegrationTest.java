package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.AuditLogRepository;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.*;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:auditTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class AuditLogIntegrationTest {
  @Autowired EntityManager em;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  @Autowired AuditLogRepository logs;
  @Autowired AuditTrail trail;
  @Autowired PlatformTransactionManager transactions;

  User user(String name, String role) {
    var u = new User();
    u.setFullName(name);
    u.setEmail(name + "@audit.test");
    u.setRole(role);
    u.setPasswordHash("never-log-this-hash");
    em.persist(u);
    em.flush();
    return u;
  }

  String token(User u) {
    return "Bearer " + jwt.issue(u.getId(), u.getRole());
  }

  @Test
  void verifiedActorBeforeAfterAndPrivacy() throws Exception {
    var manager = user("Manager", "MANAGER");
    var admin = user("Admin", "ADMIN");
    var customer = user("Customer", "CUSTOMER");
    mvc.perform(
            patch("/api/manager/users/" + customer.getId() + "/lock")
                .header("Authorization", token(manager))
                .header("X-Actor-Name", "spoofed")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"locked\":true,\"reason\":\"private reason\"}"))
        .andExpect(status().isOk());
    em.flush();
    assertEquals(1, logs.count());
    var log = logs.findAll().getFirst();
    assertEquals(manager.getId(), log.getActorId());
    assertEquals("Manager", log.getActorName());
    assertEquals("LOCK", log.getAction());
    assertTrue(log.getAfterData().contains("\"locked\":true"));
    assertTrue(log.getBeforeData().contains("\"locked\":false"));
    mvc.perform(get("/api/manager/audit-logs").header("Authorization", token(manager)))
        .andExpect(status().isNotFound());
    String body =
        mvc.perform(get("/api/admin/audit-logs").header("Authorization", token(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andReturn()
            .getResponse()
            .getContentAsString();
    for (String secret :
        new String[] {
          "private reason", "never-log-this-hash", "Customer@audit.test", "spoofed", "passwordHash"
        }) assertFalse(body.contains(secret));
    mvc.perform(
            patch("/api/manager/users/" + customer.getId() + "/lock")
                .header("Authorization", token(manager))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"locked\":true,\"reason\":\"private reason\"}"))
        .andExpect(status().isConflict());
    assertEquals(1, logs.count());
  }

  @Test
  void permissionsFiltersPaginationAndImmutableApi() throws Exception {
    var manager = user("Manager", "MANAGER");
    var admin = user("Admin", "ADMIN");
    var customer = user("Customer", "CUSTOMER");
    logs.save(new AuditLog(admin.getId(), "Admin", "ADMIN", "UPDATE", "ACCOUNT", 8L, "{}", "{}"));
    for (long id = 1; id <= 3; id++)
      logs.save(
          new AuditLog(manager.getId(), "Manager", "MANAGER", "STOCK", "PRODUCT", id, "{}", "{}"));
    em.flush();
    mvc.perform(get("/api/admin/audit-logs")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/admin/audit-logs").header("Authorization", token(customer)))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/admin/audit-logs").header("Authorization", token(manager)))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/manager/audit-logs").header("Authorization", token(manager)))
        .andExpect(status().isNotFound());
    mvc.perform(
            get("/api/admin/audit-logs?size=1&page=1&type=PRODUCT&action=STOCK&q=Manager")
                .header("Authorization", token(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.totalPages").value(3))
        .andExpect(jsonPath("$.content.length()").value(1));
    mvc.perform(get("/api/admin/audit-logs?type=ACCOUNT").header("Authorization", token(admin)))
        .andExpect(jsonPath("$.totalElements").value(1));
    mvc.perform(get("/api/admin/audit-logs").header("Authorization", token(admin)))
        .andExpect(jsonPath("$.totalElements").value(4));
    for (String filter :
        new String[] {
          "page=-1",
          "size=101",
          "type=BAD",
          "action=BAD",
          "from=2026-10-16T00:00:00Z&to=2026-10-15T00:00:00Z"
        })
      mvc.perform(get("/api/admin/audit-logs?" + filter).header("Authorization", token(admin)))
          .andExpect(status().isBadRequest());
    mvc.perform(delete("/api/admin/audit-logs/1").header("Authorization", token(admin)))
        .andExpect(status().is4xxClientError());
    assertEquals(4, logs.count());
  }

  @Test
  void orderNoOpDoesNotDuplicateAndFailedTransitionDoesNotLog() throws Exception {
    var manager = user("Manager", "MANAGER");
    var customer = user("Buyer", "CUSTOMER");
    var o = new Order();
    o.setCustomer(customer);
    o.setOrderCode(123456L);
    o.setStatus("PENDING");
    o.setPaymentMethod("COD");
    o.setPaymentStatus("COD");
    o.setTotalAmount(BigDecimal.TEN);
    em.persist(o);
    em.flush();
    String url = "/api/manager/orders/" + o.getId() + "/status";
    for (int i = 0; i < 2; i++)
      mvc.perform(
              patch(url)
                  .header("Authorization", token(manager))
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"status\":\"CONFIRMED\"}"))
          .andExpect(status().isOk());
    assertEquals(1, logs.count());
    mvc.perform(
            patch(url)
                .header("Authorization", token(manager))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"PENDING\"}"))
        .andExpect(status().isConflict());
    assertEquals(1, logs.count());
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void businessRollbackAlsoRollsBackAudit() {
    long before = logs.count();
    var request = new MockHttpServletRequest();
    request.setAttribute(
        AuditTrail.ACTOR_ATTRIBUTE, new AuditTrail.Actor(99L, "Test manager", "MANAGER"));
    RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    try {
      assertThrows(
          IllegalStateException.class,
          () ->
              new TransactionTemplate(transactions)
                  .execute(
                      status -> {
                        var u = user("rollback", "CUSTOMER");
                        trail.record(
                            "CREATE", "CUSTOMER", u.getId(), Map.of(), AuditTrail.snapshot(u));
                        em.flush();
                        throw new IllegalStateException("simulate downstream failure");
                      }));
    } finally {
      RequestContextHolder.resetRequestAttributes();
    }
    assertEquals(before, logs.count());
  }

  @Test
  void internalAccountAndVoucherProductActionsAreAuditedWithoutCredentials() throws Exception {
    var admin = user("Root", "ADMIN");
    var manager = user("Staff", "MANAGER");
    mvc.perform(
            post("/api/admin/accounts")
                .header("Authorization", token(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"fullName\":\"New"
                        + " staff\",\"email\":\"new@audit.test\",\"role\":\"MANAGER\",\"password\":\"StrongSecret123\"}"))
        .andExpect(status().isCreated());
    var account = logs.findAll().getFirst();
    assertEquals("ACCOUNT", account.getEntityType());
    assertEquals("ADMIN", account.getActorRole());
    assertFalse(account.getAfterData().contains("StrongSecret"));
    assertFalse(account.getAfterData().contains("new@audit.test"));
    mvc.perform(
            patch("/api/admin/accounts/" + account.getTargetId())
                .header("Authorization", token(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"fullName\":\"New"
                        + " staff\",\"email\":\"new@audit.test\",\"role\":\"ADMIN\",\"locked\":true}"))
        .andExpect(status().isOk());
    mvc.perform(
            post("/api/manager/products")
                .header("Authorization", token(manager))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"Audit"
                        + " product\",\"category\":\"Audit\",\"price\":10000,\"stock\":3}"))
        .andExpect(status().isOk());
    var product =
        logs.findAll().stream()
            .filter(l -> "PRODUCT".equals(l.getEntityType()))
            .findFirst()
            .orElseThrow();
    mvc.perform(
            patch("/api/manager/products/" + product.getTargetId() + "/stock")
                .header("Authorization", token(manager))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"quantity\":7}"))
        .andExpect(status().isOk());
    var stock =
        logs.findAll().stream()
            .filter(l -> "STOCK".equals(l.getAction()))
            .findFirst()
            .orElseThrow();
    assertTrue(stock.getBeforeData().contains("\"stock\":3"));
    assertTrue(stock.getAfterData().contains("\"stock\":7"));
    mvc.perform(
            post("/api/manager/vouchers")
                .header("Authorization", token(manager))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"code\":\"AUDIT10\",\"discountType\":\"PERCENTAGE\",\"discountValue\":10,\"active\":true}"))
        .andExpect(status().isCreated());
    var voucher =
        logs.findAll().stream()
            .filter(l -> "VOUCHER".equals(l.getEntityType()))
            .findFirst()
            .orElseThrow();
    mvc.perform(
            patch("/api/manager/vouchers/" + voucher.getTargetId())
                .header("Authorization", token(manager))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
        .andExpect(status().isOk());
    assertEquals(6, logs.count());
  }
}
