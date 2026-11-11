package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.entity.*;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:careReminderRace;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "crm.care-reminders.enabled=false"
    })
class CareReminderConcurrencyTest {
  @Autowired EntityManager em;
  @Autowired JdbcTemplate db;
  @Autowired PlatformTransactionManager manager;
  @Autowired CareReminderService service;

  User user(String role) {
    var u = new User();
    u.setFullName("Reminder race");
    u.setEmail(UUID.randomUUID() + "@race.test");
    u.setRole(role);
    u.setPasswordHash("test");
    em.persist(u);
    return u;
  }

  @Test
  void concurrentWorkersAndConcurrentCompletionUseTheSameTaskLock() throws Exception {
    var tx = new TransactionTemplate(manager);
    Instant now = Instant.parse("2026-10-15T05:00:00Z");
    long[] ids =
        tx.execute(
            s -> {
              var c = user("CUSTOMER");
              var m = user("MANAGER");
              var t = new CustomerCareTask();
              t.customerId = c.getId();
              t.assigneeId = m.getId();
              t.title = "Race";
              t.description = "";
              t.status = "TODO";
              t.dueAt = now.minusSeconds(1);
              t.createdAt = now;
              t.updatedAt = now;
              t.createdBy = m.getId();
              t.updatedBy = m.getId();
              em.persist(t);
              em.flush();
              return new long[] {c.getId(), m.getId(), t.id};
            });
    var pool = Executors.newFixedThreadPool(2);
    var start = new CountDownLatch(1);
    try {
      Callable<Integer> work =
          () -> {
            assertTrue(start.await(5, TimeUnit.SECONDS));
            return service.runOnce(now);
          };
      var one = pool.submit(work);
      var two = pool.submit(work);
      start.countDown();
      assertEquals(1, one.get(15, TimeUnit.SECONDS) + two.get(15, TimeUnit.SECONDS));
      assertEquals(
          1,
          db.queryForObject(
              "select count(*) from customer_notifications where care_task_id=?",
              Long.class,
              ids[2]));
      var locked = new CountDownLatch(1);
      var release = new CountDownLatch(1);
      var completing =
          pool.submit(
              () ->
                  tx.execute(
                      s -> {
                        db.queryForList(
                            "select id from customer_care_tasks where id=? for update",
                            Long.class,
                            ids[2]);
                        db.update(
                            "update customer_care_tasks set due_at=?,status='COMPLETED' where id=?",
                            CareReminderRules.timestamp(now.minusSeconds(2)),
                            ids[2]);
                        locked.countDown();
                        try {
                          assertTrue(release.await(5, TimeUnit.SECONDS));
                        } catch (InterruptedException e) {
                          throw new RuntimeException(e);
                        }
                        return null;
                      }));
      assertTrue(locked.await(5, TimeUnit.SECONDS));
      var checking = pool.submit(() -> service.runOnce(now));
      release.countDown();
      completing.get(15, TimeUnit.SECONDS);
      assertEquals(0, checking.get(15, TimeUnit.SECONDS));
      assertEquals(
          1,
          db.queryForObject(
              "select count(*) from customer_notifications where care_task_id=?",
              Long.class,
              ids[2]));
    } finally {
      start.countDown();
      pool.shutdownNow();
      assertTrue(pool.awaitTermination(20, TimeUnit.SECONDS));
      tx.execute(
          s -> {
            db.update("delete from customer_notifications where care_task_id=?", ids[2]);
            db.update("delete from customer_care_tasks where id=?", ids[2]);
            db.update("delete from customers where customer_id in (?,?)", ids[0], ids[1]);
            return null;
          });
    }
  }
}
