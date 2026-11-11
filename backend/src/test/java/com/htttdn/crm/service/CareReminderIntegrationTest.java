package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:careReminders;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "crm.care-reminders.enabled=false"
    })
@AutoConfigureMockMvc
@Transactional
class CareReminderIntegrationTest {
  @Autowired EntityManager em;
  @Autowired JdbcTemplate db;
  @Autowired CareReminderService reminders;
  @Autowired ManagerCareInbox inbox;
  @Autowired CustomerCareService care;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  final Instant now = Instant.parse("2026-10-15T05:00:00Z"); // noon Vietnam

  User user(String role) {
    var u = new User();
    u.setFullName("Reminder " + role);
    u.setEmail(UUID.randomUUID() + "@reminder.test");
    u.setPasswordHash("private-hash");
    u.setRole(role);
    em.persist(u);
    em.flush();
    return u;
  }

  CustomerCareTask task(User customer, User manager, Instant due) {
    var t = new CustomerCareTask();
    t.customerId = customer.getId();
    t.assigneeId = manager.getId();
    t.title = "Call customer";
    t.description = "Care task";
    t.status = "TODO";
    t.dueAt = due;
    t.createdAt = now;
    t.updatedAt = now;
    t.createdBy = manager.getId();
    t.updatedBy = manager.getId();
    em.persist(t);
    em.flush();
    return t;
  }

  String auth(User user) {
    return "Bearer " + jwt.issue(user.getId(), user.getRole());
  }

  @Test
  void sendsTodayThenOverdueOnlyOnceAndKeepsHistoryWithoutActiveUnreadAfterCompletion() {
    var customer = user("CUSTOMER");
    customer.setLocked(true);
    var manager = user("MANAGER");
    var t = task(customer, manager, now.plusSeconds(3600));
    assertEquals(1, reminders.runOnce(now));
    assertEquals(0, reminders.runOnce(now));
    assertEquals(1, inbox.unread(manager.getId(), now));
    var first = inbox.notifications(manager.getId(), 0, 10, now).page().content().getFirst();
    assertEquals("CARE_DUE_TODAY", first.type());
    assertTrue(first.applicable());
    assertEquals(t.id.longValue(), first.taskId());
    inbox.read(manager.getId(), first.id(), now);
    inbox.read(manager.getId(), first.id(), now);
    assertEquals(0, inbox.unread(manager.getId(), now));
    Instant late = now.plusSeconds(3601);
    assertEquals(1, reminders.runOnce(late));
    assertEquals(0, reminders.runOnce(late.plusSeconds(86400 * 4)));
    assertEquals(1, inbox.unread(manager.getId(), late));
    assertEquals(2, inbox.notifications(manager.getId(), 0, 10, late).page().totalElements());
    assertFalse(
        inbox.notifications(manager.getId(), 0, 10, late).page().content().stream()
            .filter(n -> n.type().equals("CARE_DUE_TODAY"))
            .findFirst()
            .orElseThrow()
            .applicable());
    t.status = "COMPLETED";
    t.completedAt = late;
    em.flush();
    assertEquals(0, inbox.unread(manager.getId(), late));
    assertEquals(0, reminders.runOnce(late));
    assertTrue(
        inbox.notifications(manager.getId(), 0, 10, late).page().content().stream()
            .allMatch(n -> n.state().equals("COMPLETED")));
  }

  @Test
  void overdueBacklogNewDeadlineAndReassignmentHaveIndependentKeys() {
    var buyer = user("CUSTOMER");
    var one = user("MANAGER");
    var two = user("MANAGER");
    var t = task(buyer, one, now.minusSeconds(86400 * 90));
    assertEquals(1, reminders.runOnce(now));
    assertEquals(
        "CARE_OVERDUE",
        inbox.notifications(one.getId(), 0, 10, now).page().content().getFirst().type());
    t.assigneeId = two.getId();
    em.flush();
    assertEquals(0, inbox.unread(one.getId(), now));
    assertEquals(1, reminders.runOnce(now));
    assertEquals(1, inbox.unread(two.getId(), now));
    t.dueAt = now.plusSeconds(600);
    em.flush();
    assertEquals(0, inbox.unread(two.getId(), now));
    assertEquals(1, reminders.runOnce(now));
    assertEquals(2, inbox.notifications(two.getId(), 0, 10, now).page().totalElements());
    two.setLocked(true);
    em.flush();
    assertEquals(0, inbox.unread(two.getId(), now));
    assertEquals(0, reminders.runOnce(now));
  }

  @Test
  void personalGroupsMatchSummaryAndVietnamBoundariesBeforePagination() {
    var buyer = user("CUSTOMER");
    var manager = user("MANAGER");
    var other = user("MANAGER");
    Instant tomorrow = CareReminderRules.tomorrow(now);
    var parent = task(buyer, manager, now.minusSeconds(1));
    var today = task(buyer, manager, now);
    task(buyer, manager, tomorrow.minusSeconds(1));
    task(buyer, manager, tomorrow);
    task(buyer, manager, tomorrow.plusSeconds(86400 * 7 - 1));
    task(buyer, manager, tomorrow.plusSeconds(86400 * 7));
    db.update("update customer_care_tasks set parent_task_id=? where id=?", parent.id, today.id);
    var completed = task(buyer, manager, now);
    completed.status = "COMPLETED";
    task(buyer, other, now);
    var deleted = user("CUSTOMER");
    deleted.setDeletedAt(now);
    task(deleted, manager, now);
    task(manager, manager, now);
    em.flush();
    var counts = inbox.summary(manager.getId(), now).counts();
    assertEquals(6L, counts.get("OPEN"));
    assertEquals(2L, counts.get("TODAY"));
    assertEquals(2L, counts.get("UPCOMING"));
    assertEquals(1L, counts.get("OVERDUE"));
    assertEquals(1L, counts.get("FOLLOW_UP"));
    for (var group : CareReminderRules.GROUPS) {
      var list = care.personalTasks(manager.getId(), "", group, 0, 1, now);
      assertEquals(counts.get(group).longValue(), list.totalElements());
      assertEquals(1, list.content().size());
      assertEquals(manager.getId().longValue(), list.content().getFirst().assigneeId());
    }
    assertEquals(6, care.personalTasks(manager.getId(), "Call", "OPEN", 0, 1, now).totalElements());
    assertEquals(
        0, care.personalTasks(manager.getId(), "missing", "OPEN", 0, 1, now).totalElements());
    Instant midnight = Instant.parse("2026-10-14T17:00:00Z");
    assertEquals(3L, inbox.summary(manager.getId(), midnight).counts().get("TODAY"));
    assertEquals(
        4,
        reminders.runOnce(
            midnight)); // Three tasks for manager and one for the other manager, all today in
    // Vietnam.
  }

  @Test
  void invalidAccountsDoNotGetReminders() {
    var buyer = user("CUSTOMER");
    var manager = user("MANAGER");
    var deleted = user("CUSTOMER");
    deleted.setDeletedAt(now);
    task(deleted, manager, now);
    task(manager, manager, now);
    var locked = user("MANAGER");
    locked.setLocked(true);
    task(buyer, locked, now);
    var removed = user("MANAGER");
    removed.setDeletedAt(now);
    task(buyer, removed, now);
    var changed = user("ADMIN");
    task(buyer, changed, now);
    em.flush();
    assertEquals(0, reminders.runOnce(now));
  }

  @Test
  void apiIsManagerOnlyAndPersonalScopeCannotBeOverridden() throws Exception {
    var buyer = user("CUSTOMER");
    var one = user("MANAGER");
    var two = user("MANAGER");
    var admin = user("ADMIN");
    var t = task(buyer, one, now.minusSeconds(3600));
    reminders.runOnce(now);
    long notification =
        inbox.notifications(one.getId(), 0, 10, now).page().content().getFirst().id();
    for (String url :
        new String[] {
          "/care/my-tasks",
          "/care/my-tasks/summary",
          "/notifications",
          "/notifications/summary",
          "/care/tasks/" + t.id
        }) {
      mvc.perform(get("/api/manager" + url)).andExpect(status().isUnauthorized());
      for (User wrong : new User[] {buyer, admin})
        mvc.perform(get("/api/manager" + url).header("Authorization", auth(wrong)))
            .andExpect(status().isForbidden());
    }
    mvc.perform(
            get("/api/manager/care/my-tasks?assigneeId=" + one.getId())
                .header("Authorization", auth(two)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
    mvc.perform(
            get("/api/manager/notifications?customerId=" + one.getId())
                .header("Authorization", auth(two)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page.totalElements").value(0));
    mvc.perform(
            patch("/api/manager/notifications/" + notification + "/read")
                .header("Authorization", auth(two)))
        .andExpect(status().isNotFound());
    mvc.perform(
            patch("/api/manager/notifications/" + notification + "/read")
                .header("Authorization", auth(one)))
        .andExpect(status().isNoContent());
    mvc.perform(patch("/api/manager/notifications/read-all").header("Authorization", auth(one)))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/manager/care/my-tasks?group=BAD").header("Authorization", auth(one)))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/manager/notifications?size=101").header("Authorization", auth(one)))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/manager/care/tasks/" + t.id).header("Authorization", auth(one)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(t.id));
  }
}
