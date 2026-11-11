package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:retentionTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class RetentionReportIntegrationTest {
  @Autowired RetentionReportService service;
  @Autowired CustomerLifecycleQuery customers;
  @Autowired EntityManager em;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  final Instant now = Instant.parse("2026-10-15T17:01:00Z"); // October 16 in Vietnam
  final LocalDate today = now.atZone(CustomerLifecycle.ZONE).toLocalDate();
  long code = 80000;

  User user(String name, String role) {
    var u = new User();
    u.setFullName(name);
    u.setEmail(name + "@retention.test");
    u.setRole(role);
    u.setPasswordHash("private");
    em.persist(u);
    return u;
  }

  Order order(User u, String status, String value, int days) {
    var o = new Order();
    o.setCustomer(u);
    o.setOrderCode(code++);
    o.setStatus(status);
    o.setTotalAmount(new BigDecimal(value));
    o.setPaymentMethod("COD");
    o.setPaymentStatus("COD");
    o.setCreatedAt(today.minusDays(days).atTime(23, 59).atZone(CustomerLifecycle.ZONE).toInstant());
    em.persist(o);
    return o;
  }

  long filtered(String stage, Boolean dormant, Long min) {
    return customers
        .list(
            new CustomerLifecycleQuery.Filters(
                null, stage, dormant, min, null, null, null, null, null, "createdAt", "desc", 0, 1),
            today)
        .totalElements();
  }

  @Test
  void groupsMetricsAndDrilldownsShareRulesWithoutItemDuplication() {
    user("empty", "CUSTOMER");
    var first = user("first", "CUSTOMER");
    order(first, "COMPLETED", "100", 29);
    var two = user("two", "CUSTOMER");
    for (int i = 0; i < 2; i++) order(two, "COMPLETED", "100", 30);
    var four = user("four", "CUSTOMER");
    for (int i = 0; i < 4; i++) order(four, "COMPLETED", "100", 31);
    var five = user("five", "CUSTOMER");
    for (int i = 0; i < 5; i++) order(five, "COMPLETED", "100", 0);
    var big = user("big", "CUSTOMER");
    big.setLocked(true);
    var completed = order(big, "COMPLETED", "5000000", 30);
    completed.setReturnStatus("REQUESTED");
    var deleted = user("deleted", "CUSTOMER");
    deleted.setDeletedAt(now);
    order(deleted, "COMPLETED", "99999999", 1);
    for (String role : new String[] {"ADMIN", "MANAGER"})
      order(user(role, role), "COMPLETED", "99999999", 1);
    for (String status : new String[] {"PENDING", "DELIVERED", "CANCELLED"})
      order(first, status, "99999999", 0);
    var category = new Category();
    category.setName("Retention");
    em.persist(category);
    var product = new Product();
    product.setName("Retention");
    product.setCategoryEntity(category);
    product.setPrice(BigDecimal.TEN);
    em.persist(product);
    for (int i = 0; i < 3; i++) {
      var item = new OrderItem();
      item.setOrder(completed);
      item.setProduct(product);
      item.setQuantity(1);
      item.setUnitPrice(BigDecimal.TEN);
      em.persist(item);
    }
    em.flush();
    var r = service.report(now);
    assertEquals(6, r.totalCustomers());
    assertEquals(5, r.purchasingCustomers());
    assertEquals(3, r.repeatCustomers());
    assertEquals(3, r.dormantCustomers());
    assertEquals(new BigDecimal("60.00"), r.repeatRate());
    assertEquals(0, new BigDecimal("5001200").compareTo(r.completedValue()));
    assertEquals(new BigDecimal("1000240.00"), r.averageCompletedValuePerBuyer());
    assertEquals(r.totalCustomers(), filtered(null, null, null));
    assertEquals(r.purchasingCustomers(), filtered(null, null, 1L));
    assertEquals(r.repeatCustomers(), filtered(null, null, 2L));
    assertEquals(r.dormantCustomers(), filtered(null, true, null));
    assertEquals(
        6, r.distribution().stream().mapToLong(RetentionReportService.Distribution::count).sum());
    for (var group : r.distribution())
      assertEquals(filtered(group.stage(), null, null), group.count());
    assertEquals(2, r.distribution().get(3).count());
    assertEquals(new BigDecimal("33.33"), r.distribution().get(3).percentage());
    assertEquals(30, r.thresholds().dormantDays());
    assertEquals(now, r.updatedAt());
  }

  @Test
  void emptyAndThresholdBoundariesAndVietnamMidnight() {
    var empty = service.report(now);
    assertEquals(0, empty.totalCustomers());
    assertEquals(new BigDecimal("0.00"), empty.repeatRate());
    assertEquals(new BigDecimal("0.00"), empty.averageCompletedValuePerBuyer());
    var below = user("below", "CUSTOMER");
    order(below, "COMPLETED", "4999999", 30);
    order(user("equal", "CUSTOMER"), "COMPLETED", "5000000", 29);
    order(user("above", "CUSTOMER"), "COMPLETED", "5000001", 31);
    em.flush();
    var r = service.report(now);
    assertEquals(0, r.repeatCustomers());
    assertEquals(2, r.distribution().get(3).count());
    assertEquals(2, r.dormantCustomers());
    // One minute before Vietnamese midnight, the 30-day customer is still at day 29.
    assertEquals(1, service.report(Instant.parse("2026-10-15T16:59:00Z")).dormantCustomers());
  }

  @Test
  void managerOnlyAndSafeDto() throws Exception {
    mvc.perform(get("/api/manager/reports/retention")).andExpect(status().isUnauthorized());
    for (String role : new String[] {"ADMIN", "CUSTOMER"}) {
      var u = user("wrong" + role, role);
      em.flush();
      mvc.perform(
              get("/api/manager/reports/retention")
                  .header("Authorization", "Bearer " + jwt.issue(u.getId(), role)))
          .andExpect(status().isForbidden());
    }
    var manager = user("manager", "MANAGER");
    em.flush();
    var body =
        mvc.perform(
                get("/api/manager/reports/retention")
                    .header("Authorization", "Bearer " + jwt.issue(manager.getId(), "MANAGER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalCustomers").value(1))
            .andExpect(jsonPath("$.distribution.length()").value(4))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertFalse(body.contains("password"));
    assertFalse(body.contains("email"));
    assertFalse(body.contains("token"));
  }

  @Test
  void resolvedTicketsCountTicketsNotCustomersAndExcludeDeletedAndInternalAccounts() {
    var buyer = user("ticketBuyer", "CUSTOMER");
    buyer.setLocked(true);
    var removed = user("ticketDeleted", "CUSTOMER");
    removed.setDeletedAt(now);
    var manager = user("ticketManager", "MANAGER");
    for (var owner : new User[] {buyer, buyer, buyer, removed, manager}) {
      var t = new SupportTicket();
      t.customerId = owner.getId();
      t.createdBy = manager.getId();
      t.title = "Support";
      t.description = "Private";
      t.requestKey = java.util.UUID.randomUUID().toString();
      t.status = "RESOLVED";
      t.createdAt = now;
      t.updatedAt = now;
      t.resolvedAt = now;
      em.persist(t);
    }
    var open = new SupportTicket();
    open.customerId = buyer.getId();
    open.createdBy = manager.getId();
    open.title = "Open";
    open.description = "Private";
    open.requestKey = java.util.UUID.randomUUID().toString();
    open.createdAt = now;
    open.updatedAt = now;
    em.persist(open);
    em.flush();
    assertEquals(3, service.report(now).resolvedSupportTickets());
  }
}
