package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.dto.admin.AdminDtos.StatusRequest;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:voucherTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
class VoucherIntegrationTest {
  @Test
  void newApiDefaultsToOneButExplicitNullAndOldCodesRemainUnlimited() throws Exception {
    var v =
        admin.createFromJson(
            mapper.readTree(
                "{\"code\":\""
                    + code
                    + "\",\"discountType\":\"PERCENTAGE\",\"discountValue\":10,\"minOrderAmount\":0,\"active\":true}"));
    assertEquals(1, v.perCustomerLimit());
    admin.update(v.id(), mapper.readTree("{\"active\":false}"));
    assertEquals(1, voucherRepo.findById(v.id()).orElseThrow().getPerCustomerLimit());
    var open =
        admin.createFromJson(
            mapper.readTree(
                "{\"code\":\""
                    + code
                    + "OPEN\",\"discountType\":\"PERCENTAGE\",\"discountValue\":10,\"minOrderAmount\":0,\"active\":true,\"perCustomerLimit\":null}"));
    assertNull(open.perCustomerLimit());
  }

  @Test
  void limitTwoAndFailedPayosCreationDoNotConsumeAnExtraCustomerSlot() throws Exception {
    var v = admin.create(input(code, "PERCENTAGE", "10", 20));
    admin.update(v.id(), mapper.readTree("{\"perCustomerLimit\":2}"));
    when(payos.createPaymentLink(any())).thenThrow(new IllegalStateException("Test"));
    assertThrows(IllegalStateException.class, () -> checkout("PAYOS"));
    assertNotNull(vouchers.preview(code, new BigDecimal("100000"), customer.getId()));
    checkout("COD");
    checkout("COD");
    assertThrows(ApiException.class, () -> checkout("COD"));
    assertEquals(2, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
  }

  @Test
  void personalLimitBlocksPendingOrdersAndCancellationReleasesIt() throws Exception {
    var v = admin.create(input(code, "PERCENTAGE", "10", 20));
    admin.update(v.id(), mapper.readTree("{\"perCustomerLimit\":1}"));
    assertThrows(ApiException.class, () -> vouchers.preview(code, new BigDecimal("100000")));
    var first = checkout("PAYOS");
    assertEquals(
        "VOUCHER_PER_CUSTOMER_LIMIT",
        assertThrows(ApiException.class, () -> checkout("COD")).code());
    assertEquals(
        "VOUCHER_PER_CUSTOMER_LIMIT",
        assertThrows(
                ApiException.class,
                () -> vouchers.preview(code, new BigDecimal("100000"), customer.getId()))
            .code());
    mvc.perform(
            get("/api/customers/me/vouchers")
                .header("Authorization", "Bearer " + jwt.issue(customer.getId(), "CUSTOMER")))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.content[?(@.code=='" + code + "')].selectable")
                .value(org.hamcrest.Matchers.hasItem(false)));
    User other = new User();
    other.setEmail(UUID.randomUUID() + "@limit.test");
    other.setFullName("Other");
    other.setPasswordHash("test");
    users.save(other);
    assertNotNull(vouchers.preview(code, new BigDecimal("100000"), other.getId()));
    when(payos.getPayment("TEST-LINK"))
        .thenReturn(
            new PayosService.ProviderPayment(
                first.order().orderCode(), 90000, 0, "CANCELLED", "TEST-LINK"));
    orders.cancel(customer, first.order().id(), "Test");
    orders.cancel(customer, first.order().id(), "Test");
    assertNotNull(vouchers.preview(code, new BigDecimal("100000"), customer.getId()));
    checkout("COD");
  }

  @Test
  void simultaneousOrdersCannotExceedCustomerLimit() throws Exception {
    var v = admin.create(input(code, "PERCENTAGE", "10", 20));
    admin.update(v.id(), mapper.readTree("{\"perCustomerLimit\":1}"));
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a =
          pool.submit(
              () -> {
                start.await();
                try {
                  checkout("COD");
                  return true;
                } catch (ApiException e) {
                  assertEquals("VOUCHER_PER_CUSTOMER_LIMIT", e.code());
                  return false;
                }
              });
      var b =
          pool.submit(
              () -> {
                start.await();
                try {
                  checkout("COD");
                  return true;
                } catch (ApiException e) {
                  assertEquals("VOUCHER_PER_CUSTOMER_LIMIT", e.code());
                  return false;
                }
              });
      start.countDown();
      assertNotEquals(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
    }
    assertEquals(1, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
  }

  @Test
  void loweringLimitKeepsOrdersAndNullMeansUnlimited() throws Exception {
    var v = admin.create(input(code, "PERCENTAGE", "10", 20));
    var first = checkout("COD");
    checkout("COD");
    admin.update(v.id(), mapper.readTree("{\"perCustomerLimit\":1}"));
    assertThrows(ApiException.class, () -> checkout("COD"));
    assertEquals("PENDING", orderRepo.findById(first.order().id()).orElseThrow().getStatus());
    admin.update(v.id(), mapper.readTree("{\"perCustomerLimit\":null}"));
    assertNotNull(vouchers.preview(code, new BigDecimal("100000")));
    checkout("COD");
    for (String invalid : List.of("0", "-1", "1.5", "2147483648", "\"1\""))
      assertThrows(
          ApiException.class,
          () -> admin.update(v.id(), mapper.readTree("{\"perCustomerLimit\":" + invalid + "}")));
  }

  @Test
  void paymentWebhookRacingCancellationNeverLosesPaidEvidenceOrDoubleRestocks() throws Exception {
    long id =
        orders
            .create(
                customer,
                new OrderService.CheckoutRequest(
                    "Address",
                    "PAYOS",
                    null,
                    List.of(new OrderService.RequestedItem(product.getId(), 1, null, null))))
            .order()
            .id();
    var attempt = attemptRepo.findFirstByOrderIdOrderByIdDesc(id).orElseThrow();
    when(payos.verifyWebhook(any(), any())).thenReturn(true);
    when(payos.getPayment("TEST-LINK"))
        .thenReturn(
            new PayosService.ProviderPayment(
                attempt.getProviderOrderCode(), 100000L, 0L, "PENDING", "TEST-LINK"));
    var payload =
        mapper.readTree(
            "{\"success\":true,\"data\":{\"orderCode\":"
                + attempt.getProviderOrderCode()
                + ",\"amount\":100000,\"code\":\"00\",\"paymentLinkId\":\"TEST-LINK\"}}");
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a =
          pool.submit(
              () -> {
                start.await();
                return orders.cancel(customer, id, "Test");
              });
      var b =
          pool.submit(
              () -> {
                start.await();
                return orders.webhook(payload, "test-signature");
              });
      start.countDown();
      a.get(20, TimeUnit.SECONDS);
      b.get(20, TimeUnit.SECONDS);
    }
    orders.cancel(customer, id, "Test");
    orders.webhook(payload, "test-signature");
    assertEquals("CANCELLED", orderRepo.findById(id).orElseThrow().getStatus());
    assertEquals("PAID", orderRepo.findById(id).orElseThrow().getPaymentStatus());
    assertEquals("PAID", paymentRepo.findByOrderId(id).orElseThrow().getStatus());
    assertEquals("PAID", attemptRepo.findFirstByOrderIdOrderByIdDesc(id).orElseThrow().getStatus());
    assertEquals(20, products.findById(product.getId()).orElseThrow().getStock());
  }

  @Test
  void creationRacingStockReleaseKeepsTheCommittedStock() throws Exception {
    long id =
        orders
            .create(
                customer,
                new OrderService.CheckoutRequest(
                    "Address",
                    "COD",
                    null,
                    List.of(new OrderService.RequestedItem(product.getId(), 2, null, null))))
            .order()
            .id();
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a =
          pool.submit(
              () -> {
                start.await();
                return adminOrders.updateStatus(id, new StatusRequest("CANCELLED", "Test"));
              });
      var b =
          pool.submit(
              () -> {
                start.await();
                return orders.create(
                    customer,
                    new OrderService.CheckoutRequest(
                        "Address",
                        "COD",
                        null,
                        List.of(new OrderService.RequestedItem(product.getId(), 3, null, null))));
              });
      start.countDown();
      a.get(20, TimeUnit.SECONDS);
      b.get(20, TimeUnit.SECONDS);
    }
    assertEquals(17, products.findById(product.getId()).orElseThrow().getStock());
  }

  @Test
  void paidCustomerCancellationKeepsAllPaymentEvidenceAndReleasesOnce() {
    var v = admin.create(input(code, "FIXED_AMOUNT", "10000", 5));
    var placed = checkout("PAYOS");
    long id = placed.order().id();
    tx.executeWithoutResult(
        s -> {
          Order o = orderRepo.findById(id).orElseThrow();
          o.setPaymentStatus("PAID");
          Payment p = paymentRepo.findByOrderId(id).orElseThrow();
          p.setStatus("PAID");
          PaymentAttempt a = attemptRepo.findFirstByOrderIdOrderByIdDesc(id).orElseThrow();
          a.setStatus("PAID");
        });
    orders.cancel(customer, id, "Đổi ý");
    orders.cancel(customer, id, "Gửi lại");
    assertEquals("CANCELLED", orderRepo.findById(id).orElseThrow().getStatus());
    assertEquals("PAID", orderRepo.findById(id).orElseThrow().getPaymentStatus());
    assertEquals("PAID", paymentRepo.findByOrderId(id).orElseThrow().getStatus());
    assertEquals("PAID", attemptRepo.findFirstByOrderIdOrderByIdDesc(id).orElseThrow().getStatus());
    assertEquals(20, products.findById(product.getId()).orElseThrow().getStock());
    assertEquals(0, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
  }

  @Test
  void customerAndManagerCancellationRaceReleasesOnlyOnce() throws Exception {
    var v = admin.create(input(code, "FIXED_AMOUNT", "10000", 5));
    long id = checkout("COD").order().id();
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      Future<?> a =
          pool.submit(
              () -> {
                try {
                  start.await();
                  orders.cancel(customer, id, "Test");
                } catch (InterruptedException e) {
                  throw new RuntimeException(e);
                }
              });
      Future<?> b =
          pool.submit(
              () -> {
                try {
                  start.await();
                  adminOrders.updateStatus(id, new StatusRequest("CANCELLED", "Test"));
                } catch (InterruptedException e) {
                  throw new RuntimeException(e);
                }
              });
      start.countDown();
      a.get(20, TimeUnit.SECONDS);
      b.get(20, TimeUnit.SECONDS);
    }
    assertEquals(20, products.findById(product.getId()).orElseThrow().getStock());
    assertTrue(orderRepo.findById(id).orElseThrow().isStockReleased());
    assertEquals(0, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
  }

  @Test
  void stockFailureRollsBackCancellationAndVoucherRelease() {
    var v = admin.create(input(code, "FIXED_AMOUNT", "10000", 5));
    long id = checkout("COD").order().id();
    tx.executeWithoutResult(
        s -> products.findById(product.getId()).orElseThrow().setStock(Integer.MAX_VALUE));
    assertThrows(
        ArithmeticException.class,
        () -> adminOrders.updateStatus(id, new StatusRequest("CANCELLED", "Test")));
    Order o = orderRepo.findById(id).orElseThrow();
    assertEquals("PENDING", o.getStatus());
    assertFalse(o.isStockReleased());
    assertEquals(Integer.MAX_VALUE, products.findById(product.getId()).orElseThrow().getStock());
    assertEquals(1, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
  }

  @Autowired AdminVoucherService admin;
  @Autowired InternalAccountService accounts;
  @Autowired ManagerAuthService managerAuth;
  @Autowired AdminAuthService adminAuth;
  @Autowired org.springframework.security.crypto.password.PasswordEncoder encoder;
  @Autowired DirectoryService directory;

  @Test
  void portalsRejectCrossRoleAndRevokeChangedAccounts() throws Exception {
    User root =
        accounts.create(
            new InternalAccountService.Input(
                "Admin", code + "root@test.vn", "ADMIN", "TestPass123!", false));
    User staff =
        accounts.create(
            new InternalAccountService.Input(
                "Manager", code + "staff@test.vn", "MANAGER", "TestPass123!", false));
    String a = "Bearer " + adminAuth.login(root.getEmail(), "TestPass123!").accessToken();
    var ms = managerAuth.login(staff.getEmail(), "TestPass123!");
    String m = "Bearer " + ms.accessToken();
    assertThrows(ApiException.class, () -> adminAuth.login(staff.getEmail(), "TestPass123!"));
    assertThrows(ApiException.class, () -> managerAuth.login(root.getEmail(), "TestPass123!"));
    assertThrows(ApiException.class, () -> adminAuth.refresh(ms.refreshToken()));
    mvc.perform(get("/api/admin/accounts").header("Authorization", m))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/manager/users").header("Authorization", a))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/manager/users").header("Authorization", m)).andExpect(status().isOk());
    mvc.perform(get("/api/admin/products").header("Authorization", a)).andExpect(status().isOk());
    mvc.perform(post("/api/admin/vouchers").header("Authorization", a))
        .andExpect(status().isNotFound());
    assertThrows(ApiException.class, () -> accounts.delete(root.getId(), a));
    accounts.update(
        staff.getId(),
        new InternalAccountService.Input("Manager", staff.getEmail(), "MANAGER", null, true),
        a);
    mvc.perform(get("/api/manager/users").header("Authorization", m))
        .andExpect(status().isForbidden());
    assertThrows(ApiException.class, () -> managerAuth.refresh(ms.refreshToken()));
  }

  @Test
  void selectedSurveyIsPrivateAndPublishingDoesNotDuplicateNotifications() throws Exception {
    var request =
        new com.htttdn.crm.dto.admin.AdminDtos.SurveyRequest(
            code,
            "",
            null,
            null,
            List.of(
                new com.htttdn.crm.dto.admin.AdminDtos.QuestionRequest(
                    "Q", "SINGLE_CHOICE", "[\"A\",\"B\"]", true)),
            null,
            "SELECTED",
            List.of(customer.getId()));
    Survey survey = adminSurveys.create(request);
    adminSurveys.publish(survey.getId(), true);
    adminSurveys.publish(survey.getId(), false);
    adminSurveys.publish(survey.getId(), true);
    assertEquals(
        Set.of(customer.getId()), surveyRepo.findById(survey.getId()).orElseThrow().getNotified());
    String token = "Bearer " + jwt.issue(customer.getId(), "CUSTOMER");
    mvc.perform(get("/api/surveys/" + survey.getId())).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/surveys/" + survey.getId()).header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.recipients").doesNotExist());
    User other = new User();
    other.setFullName("Other");
    other.setEmail(code + "other@test.vn");
    other.setPasswordHash("x");
    users.save(other);
    String otherToken = "Bearer " + jwt.issue(other.getId(), "CUSTOMER");
    mvc.perform(get("/api/surveys/" + survey.getId()).header("Authorization", otherToken))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/api/surveys/" + survey.getId() + "/responses")
                .header("Authorization", otherToken)
                .contentType("application/json")
                .content("{\"answers\":[]}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void supplierSearchAndAssignmentUseDatabaseFilters() {
    Supplier s = new Supplier();
    s.code = code;
    s.name = "Supplier " + code;
    s.email = "supplier@test.vn";
    s = directory.save(null, s);
    directory.assign(product.getId(), s.id);
    assertEquals(
        1,
        directory
            .products(
                code,
                "",
                s.id,
                new BigDecimal("90000"),
                new BigDecimal("110000"),
                "IN_STOCK",
                true,
                0,
                1,
                "price",
                true)
            .getTotalElements());
    assertEquals(
        0,
        directory
            .products(code, "", s.id, null, null, "OUT", true, 0, 1, "price", true)
            .getTotalElements());
    assertEquals(1, directory.suppliers(code, true, 0, 1, "name", false).getTotalElements());
    s.active = false;
    directory.save(s.id, s);
    assertEquals(0, directory.suppliers(code, true, 0, 1, "name", false).getTotalElements());
  }

  @Autowired AdminSurveyService adminSurveys;
  @Autowired SurveyRewardService rewards;
  @Autowired FeedbackRepository feedbackRepo;
  @Autowired SurveyRepository surveyRepo;
  @Autowired VoucherService vouchers;
  @Autowired OrderService orders;
  @Autowired AdminOrderService adminOrders;
  @Autowired StoreVoucherRepository voucherRepo;
  @Autowired OrderRepository orderRepo;
  @Autowired CartItemRepository cartRepo;
  @Autowired PaymentRepository paymentRepo;
  @Autowired PaymentAttemptRepository attemptRepo;
  @Autowired VoucherUsageRepository usageRepo;
  @Autowired ProductRepository products;
  @Autowired UserRepository users;
  @Autowired EntityManager em;
  @Autowired PlatformTransactionManager manager;
  @Autowired ObjectMapper mapper;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  @MockitoBean PayosService payos;
  User customer;
  Product product;
  String code;
  TransactionTemplate tx;

  @BeforeEach
  void setup() {
    tx = new TransactionTemplate(manager);
    code = "TEST_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    customer = new User();
    customer.setEmail(code + "@example.test");
    customer.setFullName("Voucher test");
    customer.setPasswordHash("test-only");
    users.save(customer);
    product =
        tx.execute(
            status -> {
              Category c = new Category();
              c.setName(code);
              em.persist(c);
              Product p = new Product();
              p.setName(code);
              p.setCategoryEntity(c);
              p.setStock(20);
              p.setPrice(new BigDecimal("100000"));
              em.persist(p);
              return p;
            });
    when(payos.createPaymentLink(any()))
        .thenReturn(new PayosService.Link("TEST-LINK", "https://example.test/payment", "000201"));
  }

  AdminVoucherService.Input input(String code, String type, String value, Integer limit) {
    return new AdminVoucherService.Input(
        code, "Test", type, new BigDecimal(value), BigDecimal.ZERO, null, limit, null, null, true);
  }

  SurveyReward reward(String value) {
    SurveyReward r = new SurveyReward();
    r.setEnabled(true);
    r.setDiscountType("PERCENTAGE");
    r.setDiscountValue(new BigDecimal(value));
    r.setMinOrderAmount(BigDecimal.ZERO);
    r.setValidDays(30);
    return r;
  }

  @Test
  void surveyIssuesOnePrivateSnapshotAndProtectsCheckout() throws Exception {
    var request =
        new com.htttdn.crm.dto.admin.AdminDtos.SurveyRequest(
            code,
            "",
            null,
            null,
            List.of(
                new com.htttdn.crm.dto.admin.AdminDtos.QuestionRequest(
                    "Chọn", "SINGLE_CHOICE", "[\"A\",\"B\"]", true)),
            reward("10"));
    Survey survey = adminSurveys.create(request);
    adminSurveys.publish(survey.getId(), true);
    String token = "Bearer " + jwt.issue(customer.getId(), "CUSTOMER");
    String body =
        mapper.writeValueAsString(
            Map.of(
                "answers",
                List.of(Map.of("questionId", survey.getQuestions().get(0).getId(), "value", "A"))));
    String url = "/api/surveys/" + survey.getId() + "/responses";
    String response =
        mvc.perform(
                post(url)
                    .header("Authorization", token)
                    .contentType("application/json")
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.voucher.discountValue").value(10))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String rewardCode = mapper.readTree(response).path("voucher").path("code").asText();
    mvc.perform(
            post(url).header("Authorization", token).contentType("application/json").content(body))
        .andExpect(status().isConflict());
    assertEquals(
        1,
        voucherRepo
            .findByOwnerCustomerId(
                customer.getId(), org.springframework.data.domain.Pageable.unpaged())
            .getTotalElements());
    adminSurveys.reward(survey.getId(), reward("20"));
    assertEquals(
        new BigDecimal("10000"),
        vouchers.preview(rewardCode, new BigDecimal("100000"), customer.getId()).discountAmount());
    assertThrows(ApiException.class, () -> vouchers.preview(rewardCode, new BigDecimal("100000")));
    assertThrows(
        ApiException.class, () -> vouchers.preview(rewardCode, new BigDecimal("100000"), -1L));
    StoreVoucher saved = voucherRepo.findByCodeIgnoreCase(rewardCode).orElseThrow();
    assertThrows(
        ApiException.class,
        () -> admin.update(saved.getId(), mapper.createObjectNode().put("active", false)));
    assertEquals(0, admin.list(rewardCode, null, 0, 10).getTotalElements());
    code = rewardCode;
    var created = checkout("COD");
    assertThrows(ApiException.class, () -> checkout("COD"));
    orders.cancel(customer, created.order().id(), "Test");
    assertEquals(0, voucherRepo.findById(saved.getId()).orElseThrow().getUsedCount());
    adminSurveys.delete(survey.getId());
    assertNotNull(vouchers.preview(rewardCode, new BigDecimal("100000"), customer.getId()));
  }

  @Test
  void rewardValidationAndRollbackDoNotLeavePartialGrants() {
    assertThrows(ApiException.class, () -> SurveyRewardService.validate(reward("101")));
    SurveyReward invalid = reward("10");
    invalid.setValidDays(0);
    assertThrows(ApiException.class, () -> SurveyRewardService.validate(invalid));
    Survey survey =
        adminSurveys.create(
            new com.htttdn.crm.dto.admin.AdminDtos.SurveyRequest(
                code,
                "",
                null,
                null,
                List.of(
                    new com.htttdn.crm.dto.admin.AdminDtos.QuestionRequest(
                        "Chọn", "SINGLE_CHOICE", "[\"A\",\"B\"]", true)),
                reward("10")));
    assertThrows(
        IllegalStateException.class,
        () ->
            tx.executeWithoutResult(
                s -> {
                  rewards.grant(survey, customer);
                  throw new IllegalStateException("rollback");
                }));
    assertEquals(
        0,
        voucherRepo
            .findByOwnerCustomerId(
                customer.getId(), org.springframework.data.domain.Pageable.unpaged())
            .getTotalElements());
  }

  @Test
  void receiptAndReviewsRequireOwnershipCompletedOrderAndPreventDuplicates() throws Exception {
    var created =
        orders.create(
            customer,
            new OrderService.CheckoutRequest(
                "Address",
                "COD",
                null,
                List.of(new OrderService.RequestedItem(product.getId(), 1, null, null))));
    Long id = created.order().id();
    String token = "Bearer " + jwt.issue(customer.getId(), "CUSTOMER");
    String url = "/api/products/" + product.getId() + "/feedback";
    String body = mapper.writeValueAsString(Map.of("orderId", id, "rating", 5, "comment", "Tốt"));
    mvc.perform(
            post(url).header("Authorization", token).contentType("application/json").content(body))
        .andExpect(status().isForbidden());
    adminOrders.updateStatus(id, new StatusRequest("CONFIRMED", null));
    adminOrders.updateStatus(id, new StatusRequest("SHIPPED", null));
    adminOrders.updateStatus(id, new StatusRequest("DELIVERED", null));
    mvc.perform(patch("/api/orders/" + id + "/confirm-receipt"))
        .andExpect(status().isUnauthorized());
    mvc.perform(patch("/api/orders/" + id + "/confirm-receipt").header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"));
    mvc.perform(
            post(url).header("Authorization", token).contentType("application/json").content(body))
        .andExpect(status().isCreated());
    mvc.perform(
            post(url).header("Authorization", token).contentType("application/json").content(body))
        .andExpect(status().isConflict());
    tx.executeWithoutResult(
        s -> {
          Feedback f = feedbackRepo.findByOrderId(id).get(0);
          f.setHidden(true);
          f.setDeletedAt(Instant.now());
          feedbackRepo.save(f);
        });
    mvc.perform(
            post(url).header("Authorization", token).contentType("application/json").content(body))
        .andExpect(status().isConflict());
    mvc.perform(get("/api/orders/" + id + "/reviews").header("Authorization", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].reviewed").value(true));
    User stranger = new User();
    stranger.setEmail(UUID.randomUUID() + "@example.test");
    stranger.setFullName("Other");
    stranger.setPasswordHash("test");
    users.save(stranger);
    mvc.perform(
            post(url)
                .header("Authorization", "Bearer " + jwt.issue(stranger.getId(), "CUSTOMER"))
                .contentType("application/json")
                .content(body))
        .andExpect(status().isNotFound());
    var again =
        orders.create(
            customer,
            new OrderService.CheckoutRequest(
                "Address",
                "COD",
                null,
                List.of(new OrderService.RequestedItem(product.getId(), 1, null, null))));
    Long otherId = again.order().id();
    adminOrders.updateStatus(otherId, new StatusRequest("CONFIRMED", null));
    adminOrders.updateStatus(otherId, new StatusRequest("SHIPPED", null));
    adminOrders.updateStatus(otherId, new StatusRequest("DELIVERED", null));
    orders.confirmReceipt(customer, otherId);
    mvc.perform(
            post(url)
                .header("Authorization", token)
                .contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("orderId", otherId, "rating", 4))))
        .andExpect(status().isCreated());
  }

  @Test
  void simultaneousSurveyResponsesGrantOnlyOneVoucher() throws Exception {
    Survey survey =
        adminSurveys.create(
            new com.htttdn.crm.dto.admin.AdminDtos.SurveyRequest(
                code,
                "",
                null,
                null,
                List.of(
                    new com.htttdn.crm.dto.admin.AdminDtos.QuestionRequest(
                        "Chọn", "SINGLE_CHOICE", "[\"A\",\"B\"]", true)),
                reward("10")));
    adminSurveys.publish(survey.getId(), true);
    String token = "Bearer " + jwt.issue(customer.getId(), "CUSTOMER");
    String body =
        mapper.writeValueAsString(
            Map.of(
                "answers",
                List.of(Map.of("questionId", survey.getQuestions().get(0).getId(), "value", "A"))));
    ExecutorService pool = Executors.newFixedThreadPool(2);
    CountDownLatch start = new CountDownLatch(1);
    try {
      Callable<Integer> action =
          () -> {
            start.await();
            return mvc.perform(
                    post("/api/surveys/" + survey.getId() + "/responses")
                        .header("Authorization", token)
                        .contentType("application/json")
                        .content(body))
                .andReturn()
                .getResponse()
                .getStatus();
          };
      Future<Integer> first = pool.submit(action), second = pool.submit(action);
      start.countDown();
      assertEquals(
          Set.of(201, 409),
          new HashSet<>(
              List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS))));
      assertEquals(
          1,
          voucherRepo
              .findByOwnerCustomerId(
                  customer.getId(), org.springframework.data.domain.Pageable.unpaged())
              .getTotalElements());
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  @org.springframework.transaction.annotation.Transactional
  void walletCombinesActiveGeneralAndOwnRewardsBeforePagination() throws Exception {
    Instant now = Instant.now();
    long baseline =
        voucherRepo
            .findWallet(customer.getId(), now, org.springframework.data.domain.Pageable.unpaged())
            .getTotalElements();
    var general = admin.create(input(code, "PERCENTAGE", "10", 5));
    StoreVoucher shared = voucherRepo.findById(general.id()).orElseThrow();
    shared.setUsedCount(1);
    voucherRepo.save(shared);
    for (String kind : List.of("DISABLED", "SCHEDULED", "EXPIRED", "EXHAUSTED", "OWN", "OTHER")) {
      StoreVoucher v = new StoreVoucher();
      v.setCode(code + kind);
      v.setDiscountValue(BigDecimal.TEN);
      switch (kind) {
        case "DISABLED" -> v.setActive(false);
        case "SCHEDULED" -> v.setStartsAt(now.plusSeconds(3600));
        case "EXPIRED" -> v.setExpiresAt(now.minusSeconds(1));
        case "EXHAUSTED" -> {
          v.setUsageLimit(1);
          v.setUsedCount(1);
        }
        case "OWN" -> {
          v.setOwnerCustomerId(customer.getId());
          v.setUsedCount(1);
          v.setUsageLimit(1);
        }
        case "OTHER" -> {
          User other = new User();
          other.setEmail(code + "wallet@example.test");
          other.setFullName("Other");
          other.setPasswordHash("test");
          users.save(other);
          v.setOwnerCustomerId(other.getId());
        }
      }
      voucherRepo.save(v);
    }
    String token = "Bearer " + jwt.issue(customer.getId(), "CUSTOMER");
    String path = "/api/customers/me/vouchers";
    mvc.perform(get(path)).andExpect(status().isUnauthorized());
    mvc.perform(get(path).header("Authorization", token).param("size", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(baseline + 2))
        .andExpect(jsonPath("$.content[0].code").value(code + "OWN"))
        .andExpect(jsonPath("$.content[0].source").value("SURVEY"))
        .andExpect(jsonPath("$.content[0].state").value("USED"));
    mvc.perform(get(path).header("Authorization", token).param("size", "1").param("page", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].code").value(code))
        .andExpect(jsonPath("$.content[0].source").value("GENERAL"))
        .andExpect(jsonPath("$.content[0].state").value("ACTIVE"));
    Long otherId =
        voucherRepo.findByCodeIgnoreCase(code + "OTHER").orElseThrow().getOwnerCustomerId();
    var otherWallet =
        voucherRepo
            .findWallet(otherId, now, org.springframework.data.domain.Pageable.unpaged())
            .getContent();
    assertTrue(otherWallet.stream().anyMatch(v -> v.getCode().equals(code)));
    assertTrue(otherWallet.stream().noneMatch(v -> v.getCode().equals(code + "OWN")));
    shared.setActive(false);
    voucherRepo.saveAndFlush(shared);
    assertEquals(
        baseline + 1,
        voucherRepo
            .findWallet(customer.getId(), now, org.springframework.data.domain.Pageable.unpaged())
            .getTotalElements());
    assertThrows(
        ApiException.class,
        () -> vouchers.preview(code, new BigDecimal("100000"), customer.getId()));
  }

  OrderService.Checkout checkout(String method) {
    return orders.create(
        customer,
        new OrderService.CheckoutRequest(
            "Test address",
            method,
            code,
            List.of(new OrderService.RequestedItem(product.getId(), 1, null, null))));
  }

  @Test
  void customerOrderHistoryFiltersAllPagesByStatusAndProductAndKeepsOwnership() {
    saveHistoryOrder("PAYOS_PENDING", "PENDING", "PAYOS", "PENDING", "NONE", customer);
    saveHistoryOrder("COD_CONFIRM", "PENDING", "COD", "COD", "NONE", customer);
    saveHistoryOrder("TO_SHIP", "PREPARING", "COD", "COD", "NONE", customer);
    saveHistoryOrder("TO_RECEIVE", "DELIVERING", "COD", "COD", "NONE", customer);
    saveHistoryOrder("DONE", "COMPLETED", "COD", "COD", "NONE", customer);
    saveHistoryOrder("VOID", "CANCELLED", "COD", "CANCELLED", "NONE", customer);
    saveHistoryOrder("RETURN", "COMPLETED", "COD", "COD", "REQUESTED", customer);
    User other = new User();
    other.setEmail("other_" + code + "@example.test");
    other.setFullName("Other customer");
    other.setPasswordHash("test-only");
    users.save(other);
    saveHistoryOrder("OTHER", "PENDING", "COD", "COD", "NONE", other);

    assertEquals(1, orders.history(customer, 0, 50, "TO_PAY", "").getTotalElements());
    assertEquals(1, orders.history(customer, 0, 50, "TO_CONFIRM", "").getTotalElements());
    assertEquals(1, orders.history(customer, 0, 50, "TO_SHIP", "").getTotalElements());
    assertEquals(1, orders.history(customer, 0, 50, "TO_RECEIVE", "").getTotalElements());
    assertEquals(1, orders.history(customer, 0, 50, "COMPLETED", "").getTotalElements());
    assertEquals(1, orders.history(customer, 0, 50, "CANCELLED", "").getTotalElements());
    assertEquals(1, orders.history(customer, 0, 50, "RETURN", "").getTotalElements());
    assertEquals(
        7,
        orders.history(customer, 0, 50, "ALL", code.toLowerCase(Locale.ROOT)).getTotalElements());
    var firstPage = orders.history(customer, 0, 1, "ALL", "");
    assertEquals(1, firstPage.getContent().size());
    assertEquals(7, firstPage.getTotalElements());
  }

  @Test
  void historyGroupsAreExclusiveEvenForUnpaidShippingAndCancelledReturns() {
    saveHistoryOrder("EXPIRED", "PREPARING", "PAYOS", "EXPIRED", "NONE", customer);
    saveHistoryOrder("FAILED", "CONFIRMED", "PAYOS", "CANCELLED", "NONE", customer);
    saveHistoryOrder("PAID", "PENDING", "PAYOS", "PAID", "NONE", customer);
    saveHistoryOrder("CANCELLED", "CANCELLED", "PAYOS", "PENDING", "REQUESTED", customer);
    saveHistoryOrder("SHIPPING", "DELIVERING", "PAYOS", "PENDING", "NONE", customer);
    saveHistoryOrder("COMPLETE", "COMPLETED", "PAYOS", "PENDING", "NONE", customer);
    saveHistoryOrder("RETURN", "COMPLETED", "PAYOS", "PENDING", "REQUESTED", customer);
    Set<Long> seen = new HashSet<>();
    for (String tab :
        List.of(
            "TO_PAY", "TO_CONFIRM", "TO_SHIP", "TO_RECEIVE", "COMPLETED", "CANCELLED", "RETURN")) {
      var result = orders.history(customer, 0, 50, tab, code);
      assertEquals(
          tab.equals("TO_PAY") ? 2 : tab.equals("TO_SHIP") ? 0 : 1, result.getTotalElements(), tab);
      for (var order : result)
        assertTrue(seen.add(order.id()), "Order appears in multiple tabs: " + order.id());
    }
    assertEquals(7, seen.size());
    var page = orders.history(customer, 1, 1, "TO_PAY", code);
    assertEquals(2, page.getTotalElements());
    assertEquals(2, page.getTotalPages());
    assertEquals(1, page.getContent().size());
    assertEquals(
        0, orders.history(customer, 0, 50, "CANCELLED", "missing-product").getTotalElements());
  }

  private void saveHistoryOrder(
      String suffix,
      String status,
      String method,
      String paymentStatus,
      String returnStatus,
      User owner) {
    tx.executeWithoutResult(
        ignored -> {
          Order order = new Order();
          order.setCustomer(em.getReference(User.class, owner.getId()));
          order.setOrderCode(Math.abs((long) (code + suffix).hashCode()) + System.nanoTime());
          order.setStatus(status);
          order.setPaymentMethod(method);
          order.setPaymentStatus(paymentStatus);
          order.setReturnStatus(returnStatus);
          order.setDeliveryAddress("Test address");
          order.setTotalAmount(new BigDecimal("100000"));
          order.setDiscountAmount(BigDecimal.ZERO);
          order.setCreatedAt(java.time.Instant.now());
          order.setUpdatedAt(java.time.Instant.now());
          OrderItem item = new OrderItem();
          item.setOrder(order);
          item.setProduct(em.getReference(Product.class, product.getId()));
          item.setQuantity(1);
          item.setUnitPrice(new BigDecimal("100000"));
          item.setSize("M");
          item.setColor("Black");
          order.getItems().add(item);
          em.persist(order);
        });
  }

  private void seedCart(String size, int quantity) {
    tx.executeWithoutResult(
        ignored -> {
          CartItem line = new CartItem();
          line.setCustomer(customer);
          line.setProduct(product);
          line.setSize(size);
          line.setColor(null);
          line.setQuantity(quantity);
          cartRepo.save(line);
        });
  }

  @Test
  void selectedCheckoutPreservesOtherVariantsAndMergesDuplicateLines() {
    product.setSizes("M,L");
    products.save(product);
    seedCart("M", 5);
    seedCart("L", 2);
    var result =
        orders.create(
            customer,
            new OrderService.CheckoutRequest(
                "Test address",
                "COD",
                null,
                List.of(
                    new OrderService.RequestedItem(product.getId(), 1, "M", null),
                    new OrderService.RequestedItem(product.getId(), 1, "M", null))));
    assertEquals(1, result.order().items().size());
    assertEquals(2, result.order().items().getFirst().quantity());
    var cart = cartRepo.findByCustomerIdOrderByIdAsc(customer.getId());
    assertEquals(2, cart.size());
    assertEquals(
        3,
        cart.stream().filter(i -> "M".equals(i.getSize())).findFirst().orElseThrow().getQuantity());
    assertEquals(
        2,
        cart.stream().filter(i -> "L".equals(i.getSize())).findFirst().orElseThrow().getQuantity());
    orders.create(
        customer,
        new OrderService.CheckoutRequest(
            "Test address",
            "COD",
            null,
            List.of(new OrderService.RequestedItem(product.getId(), 3, "M", null))));
    assertEquals("L", cartRepo.findByCustomerIdOrderByIdAsc(customer.getId()).getFirst().getSize());
  }

  @Test
  void emptySelectionAndProviderFailureKeepCartUnchanged() {
    seedCart(null, 2);
    assertThrows(
        ApiException.class,
        () ->
            orders.create(
                customer,
                new OrderService.CheckoutRequest("Test address", "COD", null, List.of())));
    when(payos.createPaymentLink(any())).thenThrow(new IllegalStateException("Provider down"));
    assertThrows(
        IllegalStateException.class,
        () ->
            orders.create(
                customer,
                new OrderService.CheckoutRequest(
                    "Test address",
                    "PAYOS",
                    null,
                    List.of(new OrderService.RequestedItem(product.getId(), 1, null, null)))));
    assertEquals(
        2, cartRepo.findByCustomerIdOrderByIdAsc(customer.getId()).getFirst().getQuantity());
    assertEquals(20, products.findById(product.getId()).orElseThrow().getStock());
    orders.create(customer, new OrderService.CheckoutRequest("Test address", "COD", null, null));
    assertTrue(cartRepo.findByCustomerIdOrderByIdAsc(customer.getId()).isEmpty());
  }

  @Test
  void codAndPayosUseSameDiscountAndBothCancelPathsReleaseOnce() {
    var v = admin.create(input(code, "PERCENTAGE", "10", 2));
    var cod = checkout("COD");
    var pay = checkout("PAYOS");
    for (var result : List.of(cod, pay)) {
      assertEquals("PENDING", result.order().status());
      assertEquals(0, new BigDecimal("90000").compareTo(result.order().totalAmount()));
      assertTrue(usageRepo.findByOrderId(result.order().id()).isPresent());
    }
    assertNull(cod.paymentUrl());
    assertNotNull(pay.paymentUrl());
    assertEquals("000201", paymentRepo.findByOrderId(pay.order().id()).orElseThrow().getQrCode());
    assertEquals(2, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
    assertThrows(ApiException.class, () -> checkout("COD"));
    orders.cancel(customer, cod.order().id(), "Test");
    orders.cancel(customer, cod.order().id(), "Test");
    adminOrders.updateStatus(pay.order().id(), new StatusRequest("CANCELLED", "Test"));
    adminOrders.updateStatus(pay.order().id(), new StatusRequest("CANCELLED", "Test"));
    assertEquals(0, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
    assertEquals(0, orderRepo.voucherSavings(code).signum());
  }

  @Test
  void providerFailureRollsBackOrderStockCounterAndUsage() {
    var v = admin.create(input(code, "FIXED_AMOUNT", "20000", 2));
    long beforeOrders = orderRepo.count(), beforeUsage = usageRepo.count();
    when(payos.createPaymentLink(any()))
        .thenThrow(new IllegalStateException("Simulated provider failure"));
    assertThrows(IllegalStateException.class, () -> checkout("PAYOS"));
    assertEquals(0, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
    assertEquals(20, products.findById(product.getId()).orElseThrow().getStock());
    assertEquals(beforeOrders, orderRepo.count());
    assertEquals(beforeUsage, usageRepo.count());
  }

  @Test
  void missingPayosConfigurationLeavesNoOrderOrInventoryChange() {
    long beforeOrders = orderRepo.count();
    doThrow(
            new ApiException(
                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                "PAYOS_NOT_CONFIGURED",
                "Chưa cấu hình PayOS"))
        .when(payos)
        .requireConfigured();
    assertEquals(
        "PAYOS_NOT_CONFIGURED",
        assertThrows(
                ApiException.class,
                () ->
                    orders.create(
                        customer,
                        new OrderService.CheckoutRequest(
                            "Test address",
                            "PAYOS",
                            null,
                            List.of(
                                new OrderService.RequestedItem(product.getId(), 1, null, null)))))
            .code());
    assertEquals(beforeOrders, orderRepo.count());
    assertEquals(20, products.findById(product.getId()).orElseThrow().getStock());
  }

  @Test
  void lastSlotIsReservedByOnlyOneConcurrentTransaction() throws Exception {
    var v = admin.create(input(code, "PERCENTAGE", "10", 1));
    CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      Callable<Boolean> task =
          () -> {
            ready.countDown();
            start.await();
            try {
              tx.executeWithoutResult(
                  s -> vouchers.reserve(code, new BigDecimal("100000"), new Order()));
              return true;
            } catch (ApiException e) {
              assertEquals("VOUCHER_EXHAUSTED", e.code());
              return false;
            }
          };
      Future<Boolean> a = pool.submit(task), b = pool.submit(task);
      assertTrue(ready.await(5, TimeUnit.SECONDS));
      start.countDown();
      assertNotEquals(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));
    }
    assertEquals(1, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
  }

  @Test
  void simultaneousCancellationOfDifferentOrdersDoesNotLoseARelease() throws Exception {
    var v = admin.create(input(code, "PERCENTAGE", "10", 3));
    var first = checkout("COD");
    var second = checkout("COD");
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a =
          pool.submit(
              () -> {
                start.await();
                return adminOrders.updateStatus(
                    first.order().id(), new StatusRequest("CANCELLED", "Test"));
              });
      var b =
          pool.submit(
              () -> {
                start.await();
                return adminOrders.updateStatus(
                    second.order().id(), new StatusRequest("CANCELLED", "Test"));
              });
      start.countDown();
      a.get(10, TimeUnit.SECONDS);
      b.get(10, TimeUnit.SECONDS);
    }
    assertEquals(0, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
    assertEquals(20, products.findById(product.getId()).orElseThrow().getStock());
  }

  @Test
  void dateAndLimitFiltersMatchTheirDisplayedStates() throws Exception {
    var v = admin.create(input(code, "PERCENTAGE", "10", 1));
    admin.update(
        v.id(),
        mapper.readTree(
            "{\"startsAt\":\"2099-01-01T00:00:00Z\",\"expiresAt\":\"2099-02-01T00:00:00Z\"}"));
    assertEquals(1, admin.list(code, "SCHEDULED", 0, 10).getTotalElements());
    admin.update(
        v.id(), mapper.readTree("{\"startsAt\":null,\"expiresAt\":\"2000-01-01T00:00:00Z\"}"));
    assertEquals(1, admin.list(code, "EXPIRED", 0, 10).getTotalElements());
    admin.update(v.id(), mapper.readTree("{\"expiresAt\":null}"));
    checkout("COD");
    assertEquals(1, admin.list(code, "EXHAUSTED", 0, 10).getTotalElements());
    assertEquals(0, admin.list(code, "ACTIVE", 0, 10).getTotalElements());
  }

  @Test
  void validationFiltersPartialUpdateAndHistoricalTotals() throws Exception {
    var v = admin.create(input(" " + code.toLowerCase() + " ", "PERCENTAGE", "10", 5));
    assertEquals(code, v.code());
    assertThrows(
        ApiException.class, () -> admin.create(input(code.toLowerCase(), "PERCENTAGE", "10", 5)));
    for (var invalid :
        List.of(
            input("bad code", "PERCENTAGE", "10", 1),
            input(code + "A", "PERCENTAGE", "101", 1),
            input(code + "B", "FIXED_AMOUNT", "0", 1),
            input(code + "C", "FIXED_AMOUNT", "1.5", 1)))
      assertThrows(ApiException.class, () -> admin.create(invalid));
    assertThrows(
        ApiException.class, () -> admin.update(v.id(), mapper.readTree("{\"code\":\"OTHER\"}")));
    assertThrows(
        ApiException.class, () -> admin.update(v.id(), mapper.readTree("{\"minOrderAmount\":-1}")));
    assertThrows(
        ApiException.class,
        () ->
            admin.update(
                v.id(),
                mapper.readTree(
                    "{\"startsAt\":\"2027-01-02T00:00:00Z\",\"expiresAt\":\"2027-01-01T00:00:00Z\"}")));
    checkout("COD");
    checkout("COD");
    assertThrows(
        ApiException.class, () -> admin.update(v.id(), mapper.readTree("{\"usageLimit\":1}")));
    assertEquals(1, admin.list(code, "ACTIVE", 0, 10).getTotalElements());
    admin.update(v.id(), mapper.readTree("{\"active\":false,\"discountValue\":20}"));
    assertEquals(1, admin.list(code, "DISABLED", 0, 10).getTotalElements());
    assertEquals(0, admin.list(code, "ACTIVE", 0, 10).getTotalElements());
    assertEquals(0, new BigDecimal("20000").compareTo(orderRepo.voucherSavings(code)));
    assertThrows(ApiException.class, () -> checkout("COD"));
  }

  @Test
  void expiredPaymentDoesNotReleaseAndFreeOrderDoesNotCallPayos() {
    var v = admin.create(input(code, "FIXED_AMOUNT", "100000", 3));
    var free = checkout("PAYOS");
    assertEquals("PENDING", free.order().status());
    assertNull(free.paymentUrl());
    assertEquals("PAID", free.order().paymentStatus());
    verify(payos, never()).createPaymentLink(any());
    tx.executeWithoutResult(
        s -> {
          var voucher = voucherRepo.findById(v.id()).orElseThrow();
          voucher.setDiscountValue(new BigDecimal("10000"));
        });
    var pending = checkout("PAYOS");
    tx.executeWithoutResult(
        s -> {
          var order = orderRepo.findById(pending.order().id()).orElseThrow();
          order.setExpiresAt(Instant.now().minusSeconds(30));
        });
    orders.cleanupExpired();
    assertEquals(2, voucherRepo.findById(v.id()).orElseThrow().getUsedCount());
    assertEquals("PENDING", orderRepo.findById(pending.order().id()).orElseThrow().getStatus());
  }

  @Test
  void retryPersistsSecondAttemptWithoutNewOrderOrInventoryChange() {
    var first =
        orders.create(
            customer,
            new OrderService.CheckoutRequest(
                "Test address",
                "PAYOS",
                null,
                List.of(new OrderService.RequestedItem(product.getId(), 1, null, null))));
    long orderId = first.order().id(), count = orderRepo.count();
    assertEquals(1, attemptRepo.findFirstByOrderIdOrderByIdDesc(orderId).stream().count());
    tx.executeWithoutResult(
        s -> {
          var order = orderRepo.findById(orderId).orElseThrow();
          order.setExpiresAt(Instant.now().minusSeconds(30));
        });
    when(payos.getPayment("TEST-LINK"))
        .thenReturn(
            new PayosService.ProviderPayment(
                first.order().orderCode(), 100000, 0, "EXPIRED", "TEST-LINK"));
    when(payos.createPaymentLink(any(Order.class), anyLong()))
        .thenReturn(new PayosService.Link("TEST-LINK-2", "https://example.test/new", "000202"));
    var retried = orders.retryPayment(customer, orderId);
    assertEquals("000202", retried.qrCode());
    assertEquals(first.order().orderCode(), retried.orderCode());
    assertEquals(count, orderRepo.count());
    assertEquals(19, products.findById(product.getId()).orElseThrow().getStock());
    assertEquals(
        "TEST-LINK-2",
        attemptRepo.findFirstByOrderIdOrderByIdDesc(orderId).orElseThrow().getPaymentLinkId());
  }

  @Test
  void paymentEndpointsRejectMissingAndOtherCustomerTokens() throws Exception {
    var placed =
        orders.create(
            customer,
            new OrderService.CheckoutRequest(
                "Test address",
                "PAYOS",
                null,
                List.of(new OrderService.RequestedItem(product.getId(), 1, null, null))));
    String path = "/api/orders/" + placed.order().id() + "/payment";
    User stranger = new User();
    stranger.setEmail(code + "other@example.test");
    stranger.setFullName("Other");
    stranger.setPasswordHash("test-only");
    users.save(stranger);
    String strangerToken = "Bearer " + jwt.issue(stranger.getId(), "CUSTOMER");
    mvc.perform(get(path)).andExpect(status().isUnauthorized());
    mvc.perform(post(path + "/sync")).andExpect(status().isUnauthorized());
    mvc.perform(post(path + "/retry")).andExpect(status().isUnauthorized());
    mvc.perform(get(path).header("Authorization", strangerToken)).andExpect(status().isNotFound());
    mvc.perform(post(path + "/sync").header("Authorization", strangerToken))
        .andExpect(status().isNotFound());
    mvc.perform(post(path + "/retry").header("Authorization", strangerToken))
        .andExpect(status().isNotFound());
  }

  @Test
  void httpApiRequiresAdminAndRetainsPublicPreviewContract() throws Exception {
    mvc.perform(get("/api/manager/vouchers")).andExpect(status().isUnauthorized());
    mvc.perform(
            get("/api/manager/vouchers")
                .header("Authorization", "Bearer " + jwt.issue(customer.getId(), "CUSTOMER")))
        .andExpect(status().isForbidden());
    User owner = new User();
    owner.setEmail(code + "admin@example.test");
    owner.setFullName("Admin");
    owner.setPasswordHash("test-only");
    owner.setRole("MANAGER");
    users.save(owner);
    String token = "Bearer " + jwt.issue(owner.getId(), "MANAGER");
    String response =
        mvc.perform(
                post("/api/manager/vouchers")
                    .header("Authorization", token)
                    .contentType("application/json")
                    .content(mapper.writeValueAsString(input(code, "PERCENTAGE", "10", 5))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.code").value(code))
            .andReturn()
            .getResponse()
            .getContentAsString();
    long id = mapper.readTree(response).path("id").asLong();
    mvc.perform(get("/api/vouchers/validate").param("code", code).param("amount", "100000"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.discountAmount").value(10000));
    mvc.perform(
            patch("/api/manager/vouchers/" + id)
                .header("Authorization", token)
                .contentType("application/json")
                .content("{\"active\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("DISABLED"));
    mvc.perform(get("/api/vouchers/validate").param("code", code).param("amount", "100000"))
        .andExpect(status().isBadRequest());
  }
}
