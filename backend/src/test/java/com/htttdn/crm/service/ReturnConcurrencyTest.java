package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:returnConcurrent;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
class ReturnConcurrencyTest {
  @Autowired ReturnManagementService service;
  @Autowired EntityManager em;
  @Autowired OrderRepository orders;
  @Autowired OrderReturnEventRepository events;
  @Autowired JwtTokenService jwt;
  @Autowired PlatformTransactionManager tx;
  @MockitoSpyBean NotificationService notifications;

  record Fixture(Long orderId, String token) {}

  Fixture fixture() {
    return new TransactionTemplate(tx)
        .execute(
            status -> {
              User m = new User();
              m.setFullName("Manager");
              m.setEmail(UUID.randomUUID() + "@test.local");
              m.setPasswordHash("hash");
              m.setRole("MANAGER");
              em.persist(m);
              User c = new User();
              c.setFullName("Customer");
              c.setEmail(UUID.randomUUID() + "@test.local");
              c.setPasswordHash("hash");
              em.persist(c);
              Order o = new Order();
              o.setOrderCode(Math.abs(UUID.randomUUID().getMostSignificantBits()));
              o.setCustomer(c);
              o.setStatus("DELIVERED");
              o.setReturnStatus("REQUESTED");
              em.persist(o);
              em.flush();
              return new Fixture(o.getId(), "Bearer " + jwt.issue(m.getId(), "MANAGER"));
            });
  }

  @Test
  void concurrentDecisionsCannotBothSucceed() throws Exception {
    var f = fixture();
    long before = events.count();
    var start = new CountDownLatch(1);
    var executor = Executors.newFixedThreadPool(2);
    try {
      java.util.List<Future<Boolean>> results = new java.util.ArrayList<>();
      for (String decision : java.util.List.of("APPROVED", "REJECTED"))
        results.add(
            executor.submit(
                () -> {
                  start.await();
                  try {
                    service.process(
                        f.token(),
                        f.orderId(),
                        new ReturnManagementService.Request(decision, "Decision"));
                    return true;
                  } catch (ApiException e) {
                    return false;
                  }
                }));
      start.countDown();
      int successes = 0;
      for (var result : results) if (result.get(10, TimeUnit.SECONDS)) successes++;
      assertEquals(1, successes);
      assertEquals(before + 1, events.count());
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  void notificationFailureRollsBackHistoryAndStatus() {
    var f = fixture();
    long before = events.count();
    doThrow(new IllegalStateException("Storage unavailable"))
        .when(notifications)
        .create(any(), anyString(), anyString(), anyString(), eq(f.orderId()));
    try {
      assertThrows(
          IllegalStateException.class,
          () ->
              service.process(
                  f.token(), f.orderId(), new ReturnManagementService.Request("APPROVED", "")));
      assertEquals("REQUESTED", orders.findById(f.orderId()).orElseThrow().getReturnStatus());
      assertEquals(before, events.count());
    } finally {
      reset(notifications);
    }
  }
}
