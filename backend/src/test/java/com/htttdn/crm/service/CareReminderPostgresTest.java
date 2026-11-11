package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL SQL/locking smoke test in transaction-local temporary tables; never migrates public
 * tables.
 */
@EnabledIfEnvironmentVariable(named = "CRM_POSTGRES_QA", matches = "true")
@SpringBootTest(
    properties = {"spring.jpa.hibernate.ddl-auto=none", "crm.care-reminders.enabled=false"})
@Transactional
class CareReminderPostgresTest {
  @Autowired JdbcTemplate db;
  @Autowired CareReminderService reminders;
  @Autowired ManagerCareInbox inbox;
  @Autowired CustomerCareService care;

  @Test
  void postgresTemporaryFixturesRollbackWithoutApplyingMigration() {
    db.execute(
        "create temporary table customers(customer_id bigint primary key,full_name"
            + " varchar(150),email varchar(255),role varchar(30),locked boolean,deleted_at"
            + " timestamptz) on commit drop");
    db.execute(
        "create temporary table customer_care_tasks(id bigint primary key,customer_id bigint"
            + " references customers(customer_id),assignee_id bigint references"
            + " customers(customer_id),title varchar(255),description varchar(4000),status"
            + " varchar(30),due_at timestamptz,created_at timestamptz,updated_at"
            + " timestamptz,completed_at timestamptz,version bigint,source_type"
            + " varchar(30),source_id bigint,outcome varchar(30),result_note"
            + " varchar(4000),parent_task_id bigint) on commit drop");
    db.execute(
        "create temporary table support_tickets(id bigint primary key,customer_id"
            + " bigint,assignee_id bigint,status varchar(30)) on commit drop");
    db.execute(
        "create temporary table customer_notifications(id bigserial primary key,customer_id bigint"
            + " references customers(customer_id),title varchar(150),content varchar(2000),type"
            + " varchar(30),care_task_id bigint references customer_care_tasks(id),care_due_at"
            + " timestamptz,support_ticket_id bigint,created_at timestamptz,read_at"
            + " timestamptz,unique(customer_id,care_task_id,type,care_due_at)) on commit drop");
    db.update(
        "insert into customers values"
            + " (1,'Buyer','buyer@qa.test','CUSTOMER',true,null),(2,'Manager','manager@qa.test','MANAGER',false,null),(3,'Other','other@qa.test','MANAGER',false,null)");
    Instant now = Instant.parse("2026-10-15T05:00:00Z");
    for (long id = 1; id <= 3; id++)
      db.update(
          "insert into"
              + " customer_care_tasks(id,customer_id,assignee_id,title,description,status,due_at,created_at,updated_at,version)"
              + " values (?,1,2,'Postgres QA','','TODO',?,?,?,0)",
          id,
          CareReminderRules.timestamp(now.plusSeconds(id == 1 ? -1 : id == 2 ? 3600 : 86400)),
          CareReminderRules.timestamp(now),
          CareReminderRules.timestamp(now));
    assertEquals(2, reminders.runOnce(now));
    assertEquals(0, reminders.runOnce(now));
    assertEquals(2, inbox.unread(2, now));
    assertEquals(0, inbox.unread(3, now));
    var stats = inbox.summary(2, now);
    assertEquals(1L, stats.counts().get("TODAY"));
    assertEquals(1L, stats.counts().get("OVERDUE"));
    assertEquals(1L, stats.counts().get("UPCOMING"));
    assertEquals(3, care.personalTasks(2, "Postgres", "OPEN", 0, 1, now).totalElements());
    assertEquals(1, care.personalTasks(2, "Postgres", "OPEN", 1, 1, now).content().size());
    var notification = inbox.notifications(2, 0, 1, now);
    assertEquals(2, notification.page().totalElements());
    assertEquals(2, notification.page().totalPages());
    inbox.readAll(2, now);
    assertEquals(0, inbox.unread(2, now));
    db.update("update customer_care_tasks set status='COMPLETED' where id=1");
    db.update("update customer_care_tasks set assignee_id=3 where id=2");
    assertTrue(
        inbox.notifications(2, 0, 10, now).page().content().stream()
            .noneMatch(ManagerCareInbox.Notification::applicable));
    assertEquals(1, reminders.runOnce(now));
    assertEquals(1, inbox.unread(3, now));
    db.update(
        "update customer_care_tasks set due_at=? where id=2",
        CareReminderRules.timestamp(now.plusSeconds(7200)));
    assertEquals(0, inbox.unread(3, now));
    assertEquals(1, reminders.runOnce(now));
    assertEquals(1, inbox.unread(3, now));
  }
}
