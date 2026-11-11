package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.entity.*;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@EnabledIfEnvironmentVariable(named = "CRM_POSTGRES_QA", matches = "true")
@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=none"})
@Transactional
class CustomerLifecyclePostgresTest {
  @Autowired EntityManager em;
  @Autowired CustomerLifecycleQuery query;
  @Autowired CustomerProfileService profile;
  @Autowired JdbcTemplate db;
  @Autowired RetentionReportService retention;

  @Test
  void postgresAggregationFiltersAndPaginationRollback() {
    Instant snapshot = Instant.now();
    var before = retention.report(snapshot);
    String key = "lifecycle-qa-" + UUID.randomUUID();
    long code = System.currentTimeMillis() * 100;
    for (int i = 0; i < 12; i++) {
      var u = new User();
      u.setFullName(key + i);
      u.setEmail(key + i + "@example.test");
      u.setRole("CUSTOMER");
      u.setPasswordHash("qa-not-for-login");
      em.persist(u);
      for (int j = 0; j < i; j++) {
        var o = new Order();
        o.setCustomer(u);
        o.setOrderCode(code++);
        o.setStatus("COMPLETED");
        o.setTotalAmount(new BigDecimal("100000"));
        o.setPaymentMethod("COD");
        o.setPaymentStatus("COD");
        if (i >= 1 && i <= 3)
          o.setCreatedAt(
              LocalDate.now(CustomerLifecycle.ZONE)
                  .minusDays(28 + i)
                  .atTime(23, 59)
                  .atZone(CustomerLifecycle.ZONE)
                  .toInstant());
        em.persist(o);
      }
      em.flush();
    }
    var f =
        new CustomerLifecycleQuery.Filters(
            key, "LOYAL", null, 5L, null, null, null, null, null, "completedOrders", "desc", 1, 3);
    var result = query.list(f);
    assertEquals(7, result.totalElements());
    assertEquals(3, result.content().size());
    assertEquals(8, result.content().getFirst().completedOrders());
    for (var row : result.content())
      assertEquals(profile.profile(row.id()).segmentation(), row.segmentation());
    var dormant =
        query.list(
            new CustomerLifecycleQuery.Filters(
                key,
                null,
                true,
                null,
                null,
                null,
                null,
                null,
                null,
                "lastPurchaseAt",
                "asc",
                0,
                10));
    assertEquals(2, dormant.totalElements());
    assertEquals(31L, dormant.content().getFirst().segmentation().daysSinceLastPurchase());
    assertEquals(30L, dormant.content().get(1).segmentation().daysSinceLastPurchase());
    long raw =
        db.queryForObject(
            "select count(*) from orders o join customers c on c.customer_id=o.customer_id where"
                + " c.full_name like ? and o.status='COMPLETED'",
            Long.class,
            key + "%");
    assertEquals(66, raw);
    var after = retention.report(snapshot);
    assertEquals(12, after.totalCustomers() - before.totalCustomers());
    assertEquals(11, after.purchasingCustomers() - before.purchasingCustomers());
    assertEquals(10, after.repeatCustomers() - before.repeatCustomers());
    assertEquals(2, after.dormantCustomers() - before.dormantCustomers());
    assertEquals(
        0,
        new BigDecimal("6600000")
            .compareTo(after.completedValue().subtract(before.completedValue())));
    assertEquals(7, after.distribution().get(3).count() - before.distribution().get(3).count());
    BigDecimal amount =
        db.queryForObject(
            "select coalesce(sum(o.total_amount),0) from orders o join customers c on"
                + " c.customer_id=o.customer_id where o.status='COMPLETED' and c.role='CUSTOMER'"
                + " and c.deleted_at is null",
            BigDecimal.class);
    assertEquals(0, amount.compareTo(after.completedValue()));
  }
}
