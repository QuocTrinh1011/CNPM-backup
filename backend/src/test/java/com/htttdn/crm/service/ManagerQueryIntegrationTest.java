package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:managerQueryTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class ManagerQueryIntegrationTest {
  @Autowired EntityManager em;
  @Autowired ManagerOrderQuery query;
  @Autowired AdminProductService products;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  User customer, manager, admin;

  @BeforeEach
  void setup() {
    customer = user("Buyer", "CUSTOMER");
    manager = user("Staff", "MANAGER");
    admin = user("Root", "ADMIN");
  }

  User user(String name, String role) {
    var u = new User();
    u.setFullName(name);
    u.setEmail(name + "@query.test");
    u.setPasswordHash("NEVER_RETURN");
    u.setRole(role);
    em.persist(u);
    return u;
  }

  Order order(long code, String status, String returns, String payment) {
    var o = new Order();
    o.setCustomer(customer);
    o.setOrderCode(code);
    o.setStatus(status);
    o.setReturnStatus(returns);
    o.setPaymentStatus(payment);
    o.setPaymentMethod("COD".equals(payment) ? "COD" : "PAYOS");
    o.setTotalAmount(BigDecimal.valueOf(code));
    em.persist(o);
    return o;
  }

  ManagerOrderQuery.Filter filter(String status, String q, String payment, int page, int size) {
    return new ManagerOrderQuery.Filter(
        status, q, payment, null, null, "totalAmount", "ASC", page, size);
  }

  @Test
  void filtersBeforePaginationCountsExclusiveGroupsAndLiteralWildcards() {
    order(1001, "DELIVERED", "REQUESTED", "COD");
    order(1002, "CANCELLED", "REQUESTED", "COD");
    order(1003, "PENDING", "NONE", "PENDING");
    order(1004, "CONFIRMED", "NONE", "PAID");
    em.flush();
    var page = query.list(filter("RETURN", "Buyer", null, 0, 1));
    assertEquals(1, page.totalElements());
    assertEquals(1001L, page.content().getFirst().orderCode());
    assertTrue(page.content().getFirst().returnHistory().isEmpty());
    var counts = query.summary(filter(null, "Buyer", null, 0, 1));
    assertEquals(4L, counts.get("ALL"));
    assertEquals(1L, counts.get("RETURN"));
    assertEquals(1L, counts.get("CANCELLED"));
    assertEquals(0L, counts.get("DELIVERED"));
    assertEquals(1, query.list(filter(null, "1004", "PAID", 0, 1)).totalElements());
    assertEquals(0, query.list(filter(null, "%", null, 0, 10)).totalElements());
    assertEquals(1002L, query.list(filter(null, "", null, 1, 1)).content().getFirst().orderCode());
  }

  @Test
  void datesUseInclusiveStartAndExclusiveEndAndRejectUnsafeFilters() {
    var o = order(1001, "PENDING", "NONE", "COD");
    Instant start = Instant.parse("2026-10-05T17:00:00Z");
    o.setCreatedAt(start);
    em.flush();
    assertEquals(
        1,
        query
            .list(
                new ManagerOrderQuery.Filter(
                    null, "", null, start, start.plusSeconds(86400), "createdAt", "DESC", 0, 20))
            .totalElements());
    assertEquals(
        0,
        query
            .list(
                new ManagerOrderQuery.Filter(
                    null, "", null, start.minusSeconds(100), start, "createdAt", "DESC", 0, 20))
            .totalElements());
    assertThrows(
        ApiException.class,
        () ->
            query.list(
                new ManagerOrderQuery.Filter(
                    null, "", null, null, null, "customer.passwordHash", "DESC", 0, 20)));
    assertThrows(ApiException.class, () -> query.list(filter("INVALID", "", null, 0, 10)));
    assertThrows(ApiException.class, () -> query.list(filter(null, "", null, -1, 10)));
  }

  @Test
  void managerDtosNeverExposeAuthenticationAndOtherRolesAreDenied() throws Exception {
    var o = order(1001, "PENDING", "NONE", "COD");
    em.flush();
    String path = "/api/manager/orders";
    for (User u : new User[] {customer, admin})
      mvc.perform(get(path).header("Authorization", "Bearer " + jwt.issue(u.getId(), u.getRole())))
          .andExpect(status().isForbidden());
    mvc.perform(
            get(path + "/" + o.getId())
                .header("Authorization", "Bearer " + jwt.issue(manager.getId(), manager.getRole())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.customer.fullName").value("Buyer"))
        .andExpect(jsonPath("$.customer.passwordHash").doesNotExist())
        .andExpect(jsonPath("$.customer.refreshTokens").doesNotExist());
    mvc.perform(get("/api/auth/password-recovery"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(false));
    mvc.perform(
            post("/api/auth/forgot-password")
                .contentType("application/json")
                .content("{\"email\":\"Buyer@query.test\"}"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.resetCode").doesNotExist());
  }

  @Test
  void productFiltersAreCombinedAcrossAllPagesAndCategoriesIncludeHiddenProducts() {
    var category = new Category();
    category.setName("Quần");
    em.persist(category);
    for (int i = 0; i < 4; i++) {
      var p = new Product();
      p.setName("Quần " + i);
      p.setCategoryEntity(category);
      p.setPrice(BigDecimal.valueOf(100 + i));
      p.setStock(i);
      p.setActive(i != 3);
      em.persist(p);
    }
    em.flush();
    var page =
        products.search(
            "Quần",
            "Quần",
            BigDecimal.valueOf(101),
            null,
            "AVAILABLE",
            "true",
            "price",
            "ASC",
            0,
            1);
    assertEquals(2, page.getTotalElements());
    assertEquals("Quần 1", page.getContent().getFirst().getName());
    assertEquals(
        "Quần 2",
        products
            .search(
                "Quần",
                "Quần",
                BigDecimal.valueOf(101),
                null,
                "AVAILABLE",
                "true",
                "price",
                "ASC",
                1,
                1)
            .getContent()
            .getFirst()
            .getName());
    assertEquals(
        1,
        products
            .search("", "", null, null, "ALL", "false", "name", "DESC", 0, 10)
            .getTotalElements());
    assertTrue(products.categoryNames().contains("Quần"));
  }
}
