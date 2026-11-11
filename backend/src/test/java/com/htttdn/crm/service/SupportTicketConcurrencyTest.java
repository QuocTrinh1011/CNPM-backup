package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.entity.User;
import jakarta.persistence.EntityManager;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:supportRace;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "crm.care-reminders.enabled=false"
    })
class SupportTicketConcurrencyTest {
  @Autowired EntityManager em;
  @Autowired SupportTicketService service;
  @Autowired JdbcTemplate db;
  @Autowired PlatformTransactionManager transactions;

  @Test
  void simultaneousRetriesCreateOneTicketAndConcurrentMessagesAreNotLost() throws Exception {
    var tx = new TransactionTemplate(transactions);
    long customer =
        tx.execute(
            s -> {
              var u = new User();
              u.setFullName("Support race");
              u.setEmail(UUID.randomUUID() + "@race.test");
              u.setPasswordHash("test");
              u.setRole("CUSTOMER");
              em.persist(u);
              em.flush();
              return u.getId();
            });
    var actor = new SupportTicketService.Actor(customer, false);
    var create =
        new SupportTicketService.Create(
            null, null, null, "Race", "Description", UUID.randomUUID().toString());
    var pool = Executors.newFixedThreadPool(2);
    var start = new CountDownLatch(1);
    try {
      Callable<Long> submit =
          () -> {
            assertTrue(start.await(5, TimeUnit.SECONDS));
            return service.create(actor, create).ticket().id();
          };
      var one = pool.submit(submit);
      var two = pool.submit(submit);
      start.countDown();
      long id = one.get(15, TimeUnit.SECONDS);
      assertEquals(id, two.get(15, TimeUnit.SECONDS));
      assertEquals(
          1,
          db.queryForObject(
              "select count(*) from support_tickets where customer_id=?", Long.class, customer));
      assertEquals(
          1,
          db.queryForObject(
              "select count(*) from customer_notifications where support_ticket_id=?",
              Long.class,
              id));
      var replyStart = new CountDownLatch(1);
      var first =
          pool.submit(
              () -> {
                assertTrue(replyStart.await(5, TimeUnit.SECONDS));
                return service.reply(
                    actor,
                    id,
                    new SupportTicketService.Reply("First", false, UUID.randomUUID().toString()));
              });
      var second =
          pool.submit(
              () -> {
                assertTrue(replyStart.await(5, TimeUnit.SECONDS));
                return service.reply(
                    actor,
                    id,
                    new SupportTicketService.Reply("Second", false, UUID.randomUUID().toString()));
              });
      replyStart.countDown();
      first.get(15, TimeUnit.SECONDS);
      second.get(15, TimeUnit.SECONDS);
      assertEquals(
          Set.of("First", "Second"),
          new HashSet<>(
              service.detail(actor, id).messages().stream()
                  .map(SupportTicketService.Message::content)
                  .toList()));
    } finally {
      start.countDown();
      pool.shutdownNow();
      assertTrue(pool.awaitTermination(20, TimeUnit.SECONDS));
      tx.execute(
          s -> {
            db.update("delete from customer_notifications where customer_id=?", customer);
            db.update("delete from support_tickets where customer_id=?", customer);
            db.update("delete from customers where customer_id=?", customer);
            return null;
          });
    }
  }
}
