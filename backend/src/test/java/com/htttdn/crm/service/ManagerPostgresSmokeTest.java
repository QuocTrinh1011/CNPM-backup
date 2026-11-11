package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.entity.Order;
import com.htttdn.crm.entity.User;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

// Opt-in only. Uses configured PostgreSQL and rolls back ALL fixtures.
@EnabledIfEnvironmentVariable(named = "CRM_POSTGRES_QA", matches = "true")
@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=none"})
@Transactional
class ManagerPostgresSmokeTest {
  @Autowired EntityManager em;
  @Autowired ManagerOrderQuery query;
  @Autowired AuthService auth;

  @Test
  void realPostgresFilteringAndCountsAcrossPagesWithRollback() {
    String unique = "qa-" + UUID.randomUUID();
    var u = new User();
    u.setEmail(unique + "@example.test");
    u.setFullName(unique);
    u.setRole("CUSTOMER");
    u.setPasswordHash("test-only-not-a-login");
    em.persist(u);
    long base = System.currentTimeMillis() * 100;
    for (int i = 0; i < 45; i++) {
      var o = new Order();
      o.setCustomer(u);
      o.setOrderCode(base + i);
      o.setStatus(i % 3 == 0 ? "CANCELLED" : "DELIVERED");
      o.setReturnStatus(i % 3 == 1 ? "REQUESTED" : "NONE");
      o.setPaymentMethod("COD");
      o.setPaymentStatus("COD");
      o.setTotalAmount(BigDecimal.valueOf(i));
      em.persist(o);
    }
    em.flush();
    var f =
        new ManagerOrderQuery.Filter(
            "RETURN", unique, null, null, null, "totalAmount", "ASC", 1, 10);
    long started = System.nanoTime();
    var page = query.list(f);
    var counts = query.summary(f);
    assertEquals(15, page.totalElements());
    assertEquals(5, page.content().size());
    assertEquals(45L, counts.get("ALL"));
    assertEquals(15L, counts.get("RETURN"));
    assertEquals(15L, counts.get("CANCELLED"));
    assertEquals(15L, counts.get("DELIVERED"));
    assertEquals(unique, query.detail(page.content().getFirst().id()).customer().fullName());
    assertFalse(auth.passwordRecoveryEnabled());
    System.out.println(
        "PostgreSQL QA: 45 rollback-only orders; filtered page + summary + detail in "
            + ((System.nanoTime() - started) / 1_000_000)
            + "ms");
  }
}
