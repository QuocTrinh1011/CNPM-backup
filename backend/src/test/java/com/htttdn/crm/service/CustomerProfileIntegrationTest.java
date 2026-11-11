package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:profileTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class CustomerProfileIntegrationTest {
  @Autowired CustomerProfileService service;
  @Autowired CustomerActivityService activities;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate db;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  User customer, other, staff, root;

  @BeforeEach
  void setup() {
    customer = user("Customer", "CUSTOMER");
    other = user("Other", "CUSTOMER");
    staff = user("Manager", "MANAGER");
    root = user("Admin", "ADMIN");
    em.flush();
  }

  User user(String name, String role) {
    User u = new User();
    u.setFullName(name);
    u.setEmail(name + "@profile.test");
    u.setPasswordHash("private-hash");
    u.setRole(role);
    em.persist(u);
    return u;
  }

  Order order(User owner, long code, String status, String amount) {
    Order o = new Order();
    o.setCustomer(owner);
    o.setOrderCode(code);
    o.setStatus(status);
    o.setTotalAmount(new BigDecimal(amount));
    o.setPaymentMethod("COD");
    o.setPaymentStatus("COD");
    em.persist(o);
    em.flush();
    return o;
  }

  String token(User user) {
    return "Bearer " + jwt.issue(user.getId(), user.getRole());
  }

  String base() {
    return "/api/manager/users/" + customer.getId() + "/profile";
  }

  @Test
  void totalsAreOrderBasedAndEmptyCustomerHasZeroValues() {
    assertEquals(0, service.profile(customer.getId()).summary().totalOrders());
    assertNull(service.profile(customer.getId()).summary().lastCompletedOrderAt());
    Order completed = order(customer, 100, "COMPLETED", "90000");
    completed.setReturnStatus("REQUESTED");
    order(customer, 101, "COMPLETED", "110000");
    order(customer, 102, "DELIVERED", "50000");
    order(customer, 103, "PENDING", "70000");
    order(customer, 104, "CANCELLED", "80000");
    order(other, 105, "COMPLETED", "999999");
    Category category = new Category();
    category.setName("Profile");
    em.persist(category);
    Product product = new Product();
    product.setName("Product");
    product.setCategoryEntity(category);
    product.setPrice(BigDecimal.TEN);
    em.persist(product);
    for (int i = 0; i < 2; i++) {
      OrderItem item = new OrderItem();
      item.setOrder(completed);
      item.setProduct(product);
      item.setQuantity(1);
      item.setUnitPrice(BigDecimal.TEN);
      em.persist(item);
    }
    em.flush();
    var summary = service.profile(customer.getId()).summary();
    assertEquals(5, summary.totalOrders());
    assertEquals(2, summary.completedOrders());
    assertEquals(1, summary.cancelledOrders());
    assertEquals(1, summary.returnOrders());
    assertEquals(0, new BigDecimal("200000").compareTo(summary.completedValue()));
    assertNotNull(summary.lastCompletedOrderAt());
    assertEquals(5, service.orders(customer.getId(), 1, 2).totalElements());
    assertEquals(3, service.orders(customer.getId(), 1, 2).totalPages());
    assertEquals(2, service.orders(customer.getId(), 1, 2).content().size());
  }

  @Test
  void managerOnlyAndExplicitProjectionsOnEveryEndpoint() throws Exception {
    for (String suffix :
        new String[] {
          "",
          "/addresses",
          "/orders",
          "/feedback",
          "/surveys",
          "/vouchers",
          "/voucher-usages",
          "/activities"
        }) {
      mvc.perform(get(base() + suffix)).andExpect(status().isUnauthorized());
      for (User wrong : new User[] {customer, root})
        mvc.perform(get(base() + suffix).header("Authorization", token(wrong)))
            .andExpect(status().isForbidden());
      String body =
          mvc.perform(get(base() + suffix).header("Authorization", token(staff)))
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString();
      assertFalse(body.contains("password"));
      assertFalse(body.contains("token"));
      assertFalse(body.contains("answers"));
      assertFalse(body.contains(other.getEmail()));
    }
    customer.setLocked(true);
    customer.setLockReason("Test reason");
    em.flush();
    mvc.perform(get(base()).header("Authorization", token(staff)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.customer.lockReason").value("Test reason"));
    mvc.perform(get(base() + "/orders?page=-1").header("Authorization", token(staff)))
        .andExpect(status().isBadRequest());
    mvc.perform(get(base() + "/orders?size=101").header("Authorization", token(staff)))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get("/api/manager/users/" + root.getId() + "/profile")
                .header("Authorization", token(staff)))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/manager/users/999999/profile").header("Authorization", token(staff)))
        .andExpect(status().isNotFound());
    customer.setDeletedAt(Instant.now());
    em.flush();
    mvc.perform(get(base()).header("Authorization", token(staff))).andExpect(status().isNotFound());
    mvc.perform(get(base() + "/orders").header("Authorization", token(staff)))
        .andExpect(status().isNotFound());
  }

  @Test
  void voucherHistoryUsesOrderSnapshotsAndDoesNotGuessLegacyRelease() {
    StoreVoucher v = new StoreVoucher();
    v.setCode("OWN");
    v.setDiscountValue(BigDecimal.TEN);
    v.setOwnerCustomerId(customer.getId());
    v.setUsageLimit(1);
    em.persist(v);
    StoreVoucher common = new StoreVoucher();
    common.setCode("COMMON");
    common.setDiscountValue(BigDecimal.TEN);
    em.persist(common);
    StoreVoucher foreign = new StoreVoucher();
    foreign.setCode("FOREIGN");
    foreign.setDiscountValue(BigDecimal.TEN);
    foreign.setOwnerCustomerId(other.getId());
    em.persist(foreign);
    Order o = order(customer, 201, "CANCELLED", "90000");
    o.setVoucherCode("ORIGINAL");
    o.setDiscountAmount(new BigDecimal("10000"));
    Order legacy = order(customer, 202, "CANCELLED", "90000");
    legacy.setVoucherCode("LEGACY");
    legacy.setDiscountAmount(new BigDecimal("10000"));
    VoucherUsage usage = new VoucherUsage(o, v);
    usage.setReleasedAt(Instant.now());
    em.persist(usage);
    em.flush();
    assertEquals(1, service.vouchers(customer.getId(), 0, 10).totalElements());
    assertEquals(
        "AVAILABLE", service.vouchers(customer.getId(), 0, 10).content().getFirst().status());
    var rows = service.voucherUsages(customer.getId(), 0, 10).content();
    assertEquals(
        "UNKNOWN",
        rows.stream()
            .filter(r -> r.code().equals("LEGACY"))
            .findFirst()
            .orElseThrow()
            .releaseStatus());
    assertEquals(
        "RELEASED",
        rows.stream()
            .filter(r -> r.code().equals("ORIGINAL"))
            .findFirst()
            .orElseThrow()
            .releaseStatus());
    assertEquals(0, new BigDecimal("10000").compareTo(rows.getFirst().discountAmount()));
    v.setUsedCount(1);
    em.flush();
    assertEquals("USED", service.vouchers(customer.getId(), 0, 10).content().getFirst().status());
    v.setUsedCount(0);
    v.setExpiresAt(Instant.now().minusSeconds(60));
    em.flush();
    assertEquals(
        "EXPIRED", service.vouchers(customer.getId(), 0, 10).content().getFirst().status());
  }

  @Test
  void hiddenFeedbackAndDeletedSurveysPreserveSafeHistory() throws Exception {
    Category c = new Category();
    c.setName("Category");
    em.persist(c);
    Product p = new Product();
    p.setCategoryEntity(c);
    p.setName("Shirt");
    p.setPrice(BigDecimal.TEN);
    em.persist(p);
    for (int i = 0; i < 3; i++) {
      Feedback f = new Feedback();
      f.setCustomer(i == 2 ? other : customer);
      f.setProduct(p);
      f.setRating(5);
      f.setHidden(true);
      f.setComment("Comment");
      if (i == 1) f.setDeletedAt(Instant.now());
      em.persist(f);
    }
    em.flush();
    assertEquals(1, service.feedback(customer.getId(), 0, 10).totalElements());
    assertTrue(service.feedback(customer.getId(), 0, 10).content().getFirst().hidden());
    db.update(
        "insert into survey_definitions(id,title,status,created_at,deleted_at) values(900,'Archived"
            + " survey','DRAFT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
    db.update(
        "insert into survey_responses(customer_id,survey_id,created_at)"
            + " values(?,900,CURRENT_TIMESTAMP)",
        customer.getId());
    StoreVoucher reward = new StoreVoucher();
    reward.setCode("REWARD");
    reward.setOwnerCustomerId(customer.getId());
    reward.setRewardSurveyId(900L);
    reward.setDiscountValue(BigDecimal.TEN);
    em.persist(reward);
    em.flush();
    var survey = service.surveys(customer.getId(), 0, 10).content().getFirst();
    assertTrue(survey.deleted());
    assertTrue(survey.rewarded());
    mvc.perform(get(base() + "/surveys").header("Authorization", token(staff)))
        .andExpect(jsonPath("$.content[0].answers").doesNotExist())
        .andExpect(jsonPath("$.content[0].customer").doesNotExist());
    db.update(
        "insert into"
            + " customer_addresses(customer_id,recipient_name,phone,address_line,default_address,created_at,updated_at)"
            + " values(?,'Recipient','0900000000','Address',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
        customer.getId());
    assertTrue(service.addresses(customer.getId(), 0, 10).content().getFirst().defaultAddress());
    assertEquals(0, service.addresses(other.getId(), 0, 10).totalElements());
  }

  @Test
  void customerSearchMatchesPhoneBeforePagination() throws Exception {
    customer.setPhone("0901234567");
    em.flush();
    mvc.perform(get("/api/manager/users?q=090123&size=1").header("Authorization", token(staff)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].id").value(customer.getId()));
  }

  @Test
  void activityIsCustomerScopedPaginatedAndDoesNotInventHistory() throws Exception {
    var own = order(customer, 777, "DELIVERED", "100");
    order(other, 778, "COMPLETED", "999");
    em.persist(
        new AuditLog(
            staff.getId(), "Manager", "MANAGER", "UPDATE", "ORDER", own.getId(), "{}", "{}"));
    em.flush();
    assertEquals(2, activities.list(customer.getId(), 0, 1).totalElements());
    assertEquals(2, activities.list(customer.getId(), 0, 1).totalPages());
    assertEquals(1, activities.list(customer.getId(), 1, 1).content().size());
    assertTrue(
        activities.list(customer.getId(), 0, 10).content().stream()
            .allMatch(e -> e.targetId() == own.getId()));
    assertEquals(1, activities.list(other.getId(), 0, 10).totalElements());
    mvc.perform(get(base() + "/activities?size=0").header("Authorization", token(staff)))
        .andExpect(status().isBadRequest());
    customer.setDeletedAt(Instant.now());
    em.flush();
    mvc.perform(get(base() + "/activities").header("Authorization", token(staff)))
        .andExpect(status().isNotFound());
  }

  @Test
  void ratingAndSurveyFiltersRunBeforePaginationAndExcludeDeletedFeedback() throws Exception {
    var category = new Category();
    category.setName("Rating");
    em.persist(category);
    var p = new Product();
    p.setCategoryEntity(category);
    p.setName("Product");
    p.setPrice(BigDecimal.TEN);
    em.persist(p);
    for (int rating : new int[] {2, 4, 5}) {
      var f = new Feedback();
      f.setCustomer(customer);
      f.setProduct(p);
      f.setRating(rating);
      f.setHidden(true);
      if (rating == 5) f.setDeletedAt(Instant.now());
      em.persist(f);
    }
    em.flush();
    db.update(
        "insert into survey_definitions(id,title,status,created_at,deleted_at) values(901,'Old"
            + " survey','DRAFT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
    db.update(
        "insert into survey_responses(customer_id,survey_id,created_at)"
            + " values(?,901,CURRENT_TIMESTAMP)",
        customer.getId());
    mvc.perform(
            get("/api/manager/users?minRating=3&maxRating=3&surveyed=true&size=1")
                .header("Authorization", token(staff)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].id").value(customer.getId()));
    mvc.perform(
            get("/api/manager/users?surveyed=false&size=1").header("Authorization", token(staff)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].id").value(other.getId()));
    for (String query : new String[] {"minRating=0", "maxRating=6", "minRating=4&maxRating=2"})
      mvc.perform(get("/api/manager/users?" + query).header("Authorization", token(staff)))
          .andExpect(status().isBadRequest());
  }
}
