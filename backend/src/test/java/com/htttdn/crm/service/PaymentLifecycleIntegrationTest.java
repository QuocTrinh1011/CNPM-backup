package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.dto.admin.AdminDtos.StatusRequest;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import java.math.BigDecimal;
import java.time.*;
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
      "spring.datasource.url=jdbc:h2:mem:payment-lifecycle;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "crm.care-reminders.enabled=false"
    })
@AutoConfigureMockMvc
class PaymentLifecycleIntegrationTest {
  @Autowired UserRepository users;
  @Autowired OrderRepository orders;
  @Autowired PaymentRepository payments;
  @Autowired OrderRefundRepository refunds;
  @Autowired PaymentAttemptRepository attempts;
  @Autowired AdminOrderService adminOrders;
  @Autowired AbandonedOrderWorker worker;
  @Autowired OrderService customerOrders;
  @Autowired JwtTokenService jwt;
  @Autowired MockMvc mvc;
  @Autowired PlatformTransactionManager tm;
  @MockitoBean PayosService payos;
  User customer, manager;
  String token;
  TransactionTemplate tx;

  @BeforeEach
  void setup() {
    tx = new TransactionTemplate(tm);
    customer = user("CUSTOMER");
    manager = user("MANAGER");
    token = "Bearer " + jwt.issue(manager.getId(), "MANAGER");
  }

  User user(String role) {
    User u = new User();
    u.setEmail(UUID.randomUUID() + "@refund.test");
    u.setFullName(role);
    u.setRole(role);
    u.setPasswordHash("test-only");
    return users.save(u);
  }

  Order order(String method, String status, String payment) {
    return tx.execute(
        s -> {
          Order o = new Order();
          o.setCustomer(customer);
          o.setOrderCode(Math.abs(UUID.randomUUID().getMostSignificantBits() % 900000000000L));
          o.setTotalAmount(new BigDecimal("100000"));
          o.setPaymentMethod(method);
          o.setStatus(status);
          o.setPaymentStatus(payment);
          o.setExpiresAt(Instant.now().minus(Duration.ofHours(25)));
          orders.saveAndFlush(o);
          Payment p = new Payment();
          p.setOrder(o);
          p.setAmount(o.getTotalAmount());
          p.setStatus(payment);
          p.setPaymentLinkId("link-" + o.getId());
          payments.save(p);
          return o;
        });
  }

  @Test
  void networkFailureAndChangedStatusNeverReleaseResources() {
    Order o = order("PAYOS", "PENDING", "EXPIRED");
    when(payos.getPayment("link-" + o.getId()))
        .thenThrow(
            new com.htttdn.crm.exception.ApiException(
                org.springframework.http.HttpStatus.BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", "Test"));
    assertEquals("RETRY", worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24)));
    Order current = orders.findById(o.getId()).orElseThrow();
    assertFalse(current.isStockReleased());
    assertEquals("PENDING", current.getStatus());
    assertTrue(current.paymentReviewRequired);
  }

  @Test
  void olderPaidAttemptPreventsCancellationEvenWhenLatestExpired() {
    Order o = order("PAYOS", "PENDING", "EXPIRED");
    String latest = "link-" + o.getId(), old = "old-" + o.getId();
    tx.executeWithoutResult(
        s -> {
          for (int i = 0; i < 2; i++) {
            var a = new PaymentAttempt();
            a.setOrder(orders.findById(o.getId()).orElseThrow());
            a.setProviderOrderCode(o.getOrderCode() + i);
            a.setPaymentLinkId(i == 0 ? old : latest);
            a.setExpiresAt(Instant.now().minus(Duration.ofHours(25)));
            attempts.save(a);
          }
        });
    when(payos.getPayment(old))
        .thenReturn(
            new PayosService.ProviderPayment(o.getOrderCode(), 100000, 100000, "PAID", old));
    when(payos.getPayment(latest))
        .thenReturn(
            new PayosService.ProviderPayment(o.getOrderCode() + 1, 100000, 0, "EXPIRED", latest));
    assertEquals("PAID", worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24)));
    assertEquals("PENDING", orders.findById(o.getId()).orElseThrow().getStatus());
    assertEquals("PAID", payments.findByOrderId(o.getId()).orElseThrow().getStatus());
    assertFalse(orders.findById(o.getId()).orElseThrow().isStockReleased());
  }

  @Test
  void paidCancellationKeepsPaymentEvidenceAndDoesNotCreateRefund() throws Exception {
    Order o = order("PAYOS", "PENDING", "PAID");
    adminOrders.updateStatus(o.getId(), new StatusRequest("CANCELLED", "Test"));
    adminOrders.updateStatus(o.getId(), new StatusRequest("CANCELLED", "Test"));
    assertTrue(refunds.findByOrderIdOrderByIdDesc(o.getId()).isEmpty());
    assertEquals("PAID", payments.findByOrderId(o.getId()).orElseThrow().getStatus());
    mvc.perform(get("/api/manager/refunds").header("Authorization", token))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/api/manager/orders/" + o.getId() + "/refunds")
                .header("Authorization", token)
                .contentType("application/json")
                .content("{}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void codCollectionIsIdempotentAndRefundRouteIsRemoved() throws Exception {
    Order o = order("COD", "DELIVERED", "COD");
    String url = "/api/manager/orders/" + o.getId() + "/cod-collection";
    mvc.perform(
            patch(url)
                .header("Authorization", token)
                .contentType("application/json")
                .content("{\"note\":\"Đã đối soát\"}"))
        .andExpect(status().isOk());
    Instant collected = orders.findById(o.getId()).orElseThrow().codCollectedAt;
    mvc.perform(
            patch(url)
                .header("Authorization", token)
                .contentType("application/json")
                .content("{\"note\":\"Gửi lại\"}"))
        .andExpect(status().isOk());
    assertEquals(collected, orders.findById(o.getId()).orElseThrow().codCollectedAt);
    assertEquals("PAID", payments.findByOrderId(o.getId()).orElseThrow().getStatus());
    mvc.perform(
            post("/api/manager/orders/" + o.getId() + "/refunds")
                .header("Authorization", token)
                .contentType("application/json")
                .content("{}"))
        .andExpect(status().isNotFound());
    Order pending = order("COD", "PENDING", "COD");
    mvc.perform(
            patch("/api/manager/orders/" + pending.getId() + "/cod-collection")
                .header("Authorization", token)
                .contentType("application/json")
                .content("{\"note\":\"Test\"}"))
        .andExpect(status().isConflict());
  }

  @Test
  void autoCancelChecksProviderAgainAndRepeatedWorkersDoNotDuplicateEffects() {
    Order o = order("PAYOS", "PENDING", "EXPIRED");
    String link = "link-" + o.getId();
    when(payos.getPayment(link))
        .thenReturn(
            new PayosService.ProviderPayment(o.getOrderCode(), 100000, 0, "PENDING", link),
            new PayosService.ProviderPayment(o.getOrderCode(), 100000, 0, "CANCELLED", link));
    assertEquals("CANCELLED", worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24)));
    assertEquals("SKIPPED", worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24)));
    verify(payos, times(1)).cancelPaymentLink(link);
    assertTrue(orders.findById(o.getId()).orElseThrow().isStockReleased());
  }

  @Test
  void newerQrAndConfirmedOrdersCannotAutoCancel() {
    Order o = order("PAYOS", "PENDING", "EXPIRED");
    tx.executeWithoutResult(
        s -> {
          PaymentAttempt a = new PaymentAttempt();
          a.setOrder(orders.findById(o.getId()).orElseThrow());
          a.setProviderOrderCode(o.getOrderCode());
          a.setPaymentLinkId("new-link");
          a.setExpiresAt(Instant.now().plusSeconds(900));
          attempts.save(a);
        });
    assertEquals("SKIPPED", worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24)));
    Order confirmed = order("PAYOS", "CONFIRMED", "EXPIRED");
    assertEquals("SKIPPED", worker.cancel(confirmed.getId(), Instant.now(), Duration.ofHours(24)));
    verifyNoInteractions(payos);
  }

  @Test
  void boundaryIsExactlyTwentyFourHoursAfterLatestExpiry() {
    Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    Order before = order("PAYOS", "PENDING", "EXPIRED"), due = order("PAYOS", "PENDING", "EXPIRED");
    tx.executeWithoutResult(
        s -> {
          orders
              .findById(before.getId())
              .orElseThrow()
              .setExpiresAt(now.minus(Duration.ofHours(24)).plusSeconds(1));
          orders.findById(due.getId()).orElseThrow().setExpiresAt(now.minus(Duration.ofHours(24)));
        });
    assertEquals("SKIPPED", worker.cancel(before.getId(), now, Duration.ofHours(24)));
    String link = "link-" + due.getId();
    when(payos.getPayment(link))
        .thenReturn(
            new PayosService.ProviderPayment(due.getOrderCode(), 100000, 0, "EXPIRED", link));
    assertEquals("CANCELLED", worker.cancel(due.getId(), now, Duration.ofHours(24)));
  }

  @Test
  void localPaidAttemptIsNeverOverwrittenByContradictoryProviderStatus() {
    Order o = order("PAYOS", "PENDING", "EXPIRED");
    String link = "link-" + o.getId();
    tx.executeWithoutResult(
        s -> {
          var a = new PaymentAttempt();
          a.setOrder(orders.findById(o.getId()).orElseThrow());
          a.setProviderOrderCode(o.getOrderCode());
          a.setPaymentLinkId(link);
          a.setStatus("PAID");
          attempts.save(a);
        });
    when(payos.getPayment(link))
        .thenReturn(
            new PayosService.ProviderPayment(o.getOrderCode(), 100000, 0, "CANCELLED", link));
    assertEquals("NEEDS_REVIEW", worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24)));
    assertEquals(
        "PAID", attempts.findFirstByOrderIdOrderByIdDesc(o.getId()).orElseThrow().getStatus());
    assertFalse(orders.findById(o.getId()).orElseThrow().isStockReleased());
  }

  @Test
  void twoSchedulersCancelTheSameOrderOnlyOnce() throws Exception {
    Order o = order("PAYOS", "PENDING", "EXPIRED");
    String link = "link-" + o.getId();
    when(payos.getPayment(link))
        .thenReturn(new PayosService.ProviderPayment(o.getOrderCode(), 100000, 0, "EXPIRED", link));
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a =
          pool.submit(
              () -> {
                start.await();
                return worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24));
              });
      var b =
          pool.submit(
              () -> {
                start.await();
                return worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24));
              });
      start.countDown();
      assertEquals(
          Set.of("CANCELLED", "SKIPPED"),
          Set.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)));
    }
    verify(payos, times(1)).getPayment(link);
  }

  @Test
  void partialMoneyUnknownProviderAndMissingLinkAreFlaggedNotCancelled() {
    for (String state : List.of("PARTIAL", "UNKNOWN", "MISSING")) {
      Order o = order("PAYOS", "PENDING", "EXPIRED");
      String link = "link-" + o.getId();
      if (state.equals("MISSING"))
        tx.executeWithoutResult(
            s -> payments.findByOrderId(o.getId()).orElseThrow().setPaymentLinkId(null));
      else
        when(payos.getPayment(link))
            .thenReturn(
                new PayosService.ProviderPayment(
                    o.getOrderCode(), 100000, state.equals("PARTIAL") ? 1 : 0, state, link));
      assertEquals("NEEDS_REVIEW", worker.cancel(o.getId(), Instant.now(), Duration.ofHours(24)));
      Order current = orders.findById(o.getId()).orElseThrow();
      assertEquals("PENDING", current.getStatus());
      assertTrue(current.paymentReviewRequired);
      assertFalse(current.isStockReleased());
    }
  }

  @Test
  void syncOfCancelledPaidOrderRecordsPaymentWithoutCreatingRefund() throws Exception {
    Order o = order("PAYOS", "CANCELLED", "CANCELLED");
    String link = "link-" + o.getId();
    tx.executeWithoutResult(
        s -> {
          var a = new PaymentAttempt();
          a.setOrder(orders.findById(o.getId()).orElseThrow());
          a.setProviderOrderCode(o.getOrderCode());
          a.setPaymentLinkId(link);
          attempts.save(a);
        });
    when(payos.getPayment(link))
        .thenReturn(
            new PayosService.ProviderPayment(o.getOrderCode(), 100000, 100000, "PAID", link));
    customerOrders.syncPayment(customer, o.getId());
    customerOrders.syncPayment(customer, o.getId());
    assertTrue(refunds.findByOrderIdOrderByIdDesc(o.getId()).isEmpty());
    assertEquals("PAID", orders.findById(o.getId()).orElseThrow().getPaymentStatus());
  }

  @Test
  void reconcilingLegacyAlreadyPaidCancellationDoesNotBackfillRefunds() throws Exception {
    Order o = order("PAYOS", "CANCELLED", "PAID");
    String link = "link-" + o.getId();
    when(payos.getPayment(link))
        .thenReturn(
            new PayosService.ProviderPayment(o.getOrderCode(), 100000, 100000, "PAID", link));
    mvc.perform(
            post("/api/manager/orders/" + o.getId() + "/payment/reconcile")
                .header("Authorization", token))
        .andExpect(status().isOk());
    assertTrue(refunds.findByOrderIdOrderByIdDesc(o.getId()).isEmpty());
  }
}
