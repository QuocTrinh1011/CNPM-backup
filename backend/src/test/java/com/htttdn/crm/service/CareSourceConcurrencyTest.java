package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:careSourceRace;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
class CareSourceConcurrencyTest {
  @Autowired EntityManager em;
  @Autowired CustomerCareService care;
  @Autowired PlatformTransactionManager manager;
  @Autowired JwtTokenService jwt;
  @Autowired JdbcTemplate db;

  @Test
  void simultaneousFollowUpsCreateOnlyOneChild() throws Exception {
    var tx = new TransactionTemplate(manager);
    long[] ids =
        tx.execute(
            status -> {
              var c = new User();
              c.setFullName("Follow buyer");
              c.setEmail("follow-buyer@race.test");
              c.setPasswordHash("test");
              c.setRole("CUSTOMER");
              em.persist(c);
              var m = new User();
              m.setFullName("Follow manager");
              m.setEmail("follow-manager@race.test");
              m.setPasswordHash("test");
              m.setRole("MANAGER");
              em.persist(m);
              var t = new CustomerCareTask();
              t.customerId = c.getId();
              t.assigneeId = m.getId();
              t.title = "Completed";
              t.description = "";
              t.status = "COMPLETED";
              t.dueAt = Instant.now();
              t.createdBy = m.getId();
              t.updatedBy = m.getId();
              t.createdAt = Instant.now();
              t.updatedAt = t.createdAt;
              t.completedAt = t.createdAt;
              t.outcome = "NEEDS_FOLLOW_UP";
              em.persist(t);
              em.flush();
              return new long[] {c.getId(), m.getId(), t.id};
            });
    var pool = Executors.newFixedThreadPool(2);
    var start = new CountDownLatch(1);
    try {
      String auth = "Bearer " + jwt.issue(ids[1], "MANAGER");
      Callable<String> follow =
          () -> {
            assertTrue(start.await(5, TimeUnit.SECONDS));
            try {
              care.followUp(
                  auth,
                  ids[2],
                  new CustomerCareService.FollowUp(
                      ids[1], "Next", "", Instant.now().plusSeconds(3600)));
              return "CREATED";
            } catch (ApiException e) {
              return e.code();
            }
          };
      var one = pool.submit(follow);
      var two = pool.submit(follow);
      start.countDown();
      var results = List.of(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS));
      assertEquals(1, results.stream().filter("CREATED"::equals).count());
      assertEquals(1, results.stream().filter("CARE_FOLLOW_UP_EXISTS"::equals).count());
      assertEquals(
          1,
          db.queryForObject(
              "select count(*) from customer_care_tasks where parent_task_id=?",
              Long.class,
              ids[2]));
    } finally {
      start.countDown();
      pool.shutdownNow();
      assertTrue(pool.awaitTermination(20, TimeUnit.SECONDS));
      tx.execute(
          status -> {
            db.update("delete from customer_care_tasks where parent_task_id=?", ids[2]);
            db.update("delete from customer_care_tasks where id=?", ids[2]);
            db.update("delete from customers where customer_id in (?,?)", ids[0], ids[1]);
            return null;
          });
    }
  }

  @Test
  void simultaneousCreationCreatesOnlyOneOpenTask() throws Exception {
    var tx = new TransactionTemplate(manager);
    long[] ids =
        tx.execute(
            status -> {
              var customer = new User();
              customer.setFullName("Buyer");
              customer.setEmail("buyer@source-race.test");
              customer.setPasswordHash("test");
              customer.setRole("CUSTOMER");
              em.persist(customer);
              var staff = new User();
              staff.setFullName("Staff");
              staff.setEmail("staff@source-race.test");
              staff.setPasswordHash("test");
              staff.setRole("MANAGER");
              em.persist(staff);
              var order = new Order();
              order.setCustomer(customer);
              order.setOrderCode(999111L);
              order.setTotalAmount(BigDecimal.TEN);
              order.setPaymentMethod("COD");
              order.setPaymentStatus("COD");
              order.setStatus("DELIVERED");
              order.setReturnStatus("REQUESTED");
              em.persist(order);
              em.flush();
              return new long[] {customer.getId(), staff.getId(), order.getId()};
            });
    var pool = Executors.newFixedThreadPool(2);
    var start = new CountDownLatch(1);
    var ready = new CountDownLatch(2);
    try {
      String auth = "Bearer " + jwt.issue(ids[1], "MANAGER");
      Callable<String> create =
          () -> {
            ready.countDown();
            assertTrue(start.await(5, TimeUnit.SECONDS));
            try {
              care.create(
                  auth,
                  new CustomerCareService.CreateTask(
                      ids[0],
                      ids[1],
                      "Return follow-up",
                      "",
                      Instant.now(),
                      "RETURN_ORDER",
                      ids[2]));
              return "CREATED";
            } catch (ApiException e) {
              return e.code();
            }
          };
      var one = pool.submit(create);
      var two = pool.submit(create);
      assertTrue(ready.await(5, TimeUnit.SECONDS));
      start.countDown();
      var results = List.of(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS));
      assertEquals(1, results.stream().filter("CREATED"::equals).count());
      assertEquals(1, results.stream().filter("CARE_SOURCE_OPEN"::equals).count());
      assertEquals(
          1,
          db.queryForObject(
              "select count(*) from customer_care_tasks where source_type='RETURN_ORDER' and"
                  + " source_id=?",
              Long.class,
              ids[2]));
    } finally {
      start.countDown();
      pool.shutdownNow();
      assertTrue(pool.awaitTermination(20, TimeUnit.SECONDS));
      tx.execute(
          status -> {
            db.update("delete from customer_care_tasks where customer_id=?", ids[0]);
            db.update("delete from orders where order_id=?", ids[2]);
            db.update("delete from customers where customer_id in (?,?)", ids[0], ids[1]);
            return null;
          });
    }
  }
}
