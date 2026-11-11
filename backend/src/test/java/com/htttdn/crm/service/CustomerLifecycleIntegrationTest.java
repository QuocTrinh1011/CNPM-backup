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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:lifecycleTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class CustomerLifecycleIntegrationTest {
  @Autowired CustomerLifecycleQuery query;
  @Autowired CustomerProfileService profile;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate db;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  LocalDate today = LocalDate.of(2026, 10, 6);
  long code = 900;

  User customer(String name, String role) {
    var u = new User();
    u.setFullName(name);
    u.setEmail(name + "@lifecycle.test");
    u.setPasswordHash("secret");
    u.setRole(role);
    em.persist(u);
    em.flush();
    return u;
  }

  Order order(User u, String status, String value, int days) {
    var o = new Order();
    o.setCustomer(u);
    o.setOrderCode(code++);
    o.setStatus(status);
    o.setPaymentMethod("COD");
    o.setPaymentStatus("COD");
    o.setTotalAmount(new BigDecimal(value));
    o.setCreatedAt(today.minusDays(days).atTime(23, 59).atZone(CustomerLifecycle.ZONE).toInstant());
    em.persist(o);
    em.flush();
    return o;
  }

  CustomerLifecycleQuery.Filters filters(
      String stage, Boolean dormant, int page, int size, String sort) {
    return new CustomerLifecycleQuery.Filters(
        "life", stage, dormant, null, null, null, null, null, null, sort, "desc", page, size);
  }

  @Test
  void aggregatesBeforePaginationAndIncludesLockedReturnOrdersButNotStaffDeletedOrOtherStatuses() {
    User empty = customer("life-empty", "CUSTOMER"),
        first = customer("life-first", "CUSTOMER"),
        loyal = customer("life-loyal", "CUSTOMER");
    loyal.setLocked(true);
    customer("life-staff", "MANAGER");
    customer("life-admin", "ADMIN");
    var deleted = customer("life-deleted", "CUSTOMER");
    deleted.setDeletedAt(Instant.now());
    order(first, "COMPLETED", "100", 29);
    order(first, "PENDING", "9000000", 0);
    order(first, "DELIVERED", "9000000", 0);
    order(first, "CANCELLED", "9000000", 0);
    Order o = order(loyal, "COMPLETED", "5000000", 30);
    o.setReturnStatus("REQUESTED");
    em.flush();
    var category = new Category();
    category.setName("Lifecycle");
    em.persist(category);
    var product = new Product();
    product.setName("Lifecycle product");
    product.setCategoryEntity(category);
    product.setPrice(BigDecimal.TEN);
    em.persist(product);
    for (int i = 0; i < 3; i++) {
      var item = new OrderItem();
      item.setOrder(o);
      item.setProduct(product);
      item.setQuantity(1);
      item.setUnitPrice(BigDecimal.TEN);
      em.persist(item);
    }
    em.flush();
    var all = query.list(filters(null, null, 0, 1, "completedValue"), today);
    assertEquals(3, all.totalElements());
    assertEquals(3, all.totalPages());
    assertEquals(loyal.getId(), all.content().getFirst().id());
    var row = query.list(filters("LOYAL", true, 0, 10, "createdAt"), today).content().getFirst();
    assertTrue(row.locked());
    assertEquals(1, row.completedOrders());
    assertEquals(30L, row.segmentation().daysSinceLastPurchase());
    assertEquals(
        1, query.list(filters("NO_PURCHASE", false, 0, 10, "createdAt"), today).totalElements());
    assertEquals(
        0, query.list(filters("NO_PURCHASE", true, 0, 10, "createdAt"), today).totalElements());
    var current =
        query.list(filters("FIRST_PURCHASE", null, 0, 10, "createdAt")).content().getFirst();
    assertEquals(profile.profile(first.getId()).segmentation(), current.segmentation());
    assertEquals(0, new BigDecimal("100").compareTo(current.completedValue()));
    var f =
        new CustomerLifecycleQuery.Filters(
            "first",
            "FIRST_PURCHASE",
            false,
            1L,
            1L,
            new BigDecimal("100"),
            new BigDecimal("100"),
            today.minusDays(29),
            today.minusDays(29),
            "lastPurchaseAt",
            "asc",
            0,
            1);
    assertEquals(1, query.list(f, today).totalElements());
    assertEquals(
        0,
        query
            .list(
                new CustomerLifecycleQuery.Filters(
                    "%",
                    null, null, null, null, null, null, null, null, "createdAt", "desc", 0, 10),
                today)
            .totalElements());
  }

  @Test
  void invalidFiltersAndManagerOnlySafeResponses() throws Exception {
    User manager = customer("life-manager", "MANAGER"),
        u = customer("life-customer", "CUSTOMER"),
        admin = customer("life-root", "ADMIN");
    mvc.perform(get("/api/manager/users")).andExpect(status().isUnauthorized());
    for (User wrong : new User[] {u, admin})
      mvc.perform(
              get("/api/manager/users")
                  .header("Authorization", "Bearer " + jwt.issue(wrong.getId(), wrong.getRole())))
          .andExpect(status().isForbidden());
    String token = "Bearer " + jwt.issue(manager.getId(), manager.getRole());
    String body =
        mvc.perform(
                get("/api/manager/users?stage=NO_PURCHASE&size=1").header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].segmentation.stage").value("NO_PURCHASE"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertFalse(body.contains("password"));
    assertFalse(body.contains("token"));
    for (String bad :
        new String[] {
          "stage=BAD",
          "sort=DROP",
          "direction=INVALID",
          "page=-1",
          "size=101",
          "minCompletedOrders=2&maxCompletedOrders=1",
          "minCompletedValue=-1",
          "lastPurchaseFrom=2026-10-07&lastPurchaseTo=2026-10-06"
        })
      mvc.perform(get("/api/manager/users?" + bad).header("Authorization", token))
          .andExpect(status().isBadRequest());
  }
}
