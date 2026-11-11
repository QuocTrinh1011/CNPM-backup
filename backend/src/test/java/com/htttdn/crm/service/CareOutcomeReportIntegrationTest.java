package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:careOutcomeReport;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class CareOutcomeReportIntegrationTest {
  @Autowired CareOutcomeReportService reports;
  @Autowired CustomerCareService care;
  @Autowired EntityManager em;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  final LocalDate day = LocalDate.of(2026, 10, 15);

  User user(String name, String role) {
    var u = new User();
    u.setFullName(name);
    u.setEmail(name + "@outcome-report.test");
    u.setPasswordHash("never-return-this");
    u.setRole(role);
    em.persist(u);
    em.flush();
    return u;
  }

  CustomerCareTask task(User buyer, User staff, String outcome, Instant completed) {
    var t = new CustomerCareTask();
    t.customerId = buyer.getId();
    t.assigneeId = staff.getId();
    t.title = "Report task";
    t.description = "private description";
    t.status = "COMPLETED";
    t.outcome = outcome;
    t.resultNote = "private result";
    t.dueAt = Instant.parse("2026-11-01T00:00:00Z");
    t.completedAt = completed;
    t.createdAt = Instant.now();
    t.updatedAt = t.createdAt;
    t.createdBy = staff.getId();
    t.updatedBy = staff.getId();
    em.persist(t);
    em.flush();
    return t;
  }

  CustomerCareService.Filters filter(String outcome, LocalDate from, LocalDate to, Long staff) {
    return new CustomerCareService.Filters(
        "", null, staff, "COMPLETED", null, 0, 1, null, null, outcome, from, to);
  }

  @Test
  void groupsCompletedWorkAndCountsUnknownWithoutGuessingOrDeduplicatingCustomers() {
    var buyer = user("Buyer", "CUSTOMER");
    buyer.setLocked(true);
    var active = user("Active", "MANAGER");
    var inactive = user("Inactive", "MANAGER");
    inactive.setLocked(true);
    var parent = task(buyer, active, "CONTACTED", Instant.parse("2026-10-14T17:00:00Z"));
    var unreachable = task(buyer, active, "UNREACHABLE", Instant.parse("2026-10-15T16:59:59Z"));
    unreachable.dueAt = Instant.parse("2026-01-01T00:00:00Z");
    task(buyer, active, "RESOLVED", Instant.parse("2026-10-15T01:00:00Z"));
    var child = task(buyer, inactive, "NEEDS_FOLLOW_UP", Instant.parse("2026-10-15T17:00:00Z"));
    child.parentTaskId = parent.id;
    task(buyer, active, null, Instant.parse("2026-10-15T01:00:00Z"));
    task(buyer, active, "", Instant.parse("2026-10-15T01:00:00Z"));
    task(buyer, inactive, "INVALID", Instant.parse("2026-10-15T01:00:00Z"));
    task(buyer, inactive, null, null);
    var pending = task(buyer, active, "RESOLVED", Instant.parse("2026-10-15T01:00:00Z"));
    pending.status = "TODO";
    var deleted = user("Deleted", "CUSTOMER");
    deleted.setDeletedAt(Instant.now());
    task(deleted, active, "RESOLVED", Instant.now());
    task(active, active, "RESOLVED", Instant.now());
    em.flush();
    var all = reports.report(null, null, null);
    assertEquals(8, all.counts().completed());
    assertEquals(4, all.counts().recorded());
    assertEquals(4, all.counts().unrecorded());
    assertEquals(new BigDecimal("25.00"), all.counts().resolvedRate());
    assertEquals(2, all.staff().size());
    assertFalse(
        all.staff().stream()
            .filter(s -> s.id() == inactive.getId())
            .findFirst()
            .orElseThrow()
            .active());
    assertEquals(
        all.counts().completed(), care.tasks(filter(null, null, null, null)).totalElements());
    assertEquals(
        all.counts().recorded(), care.tasks(filter("RECORDED", null, null, null)).totalElements());
    assertEquals(
        all.counts().unrecorded(),
        care.tasks(filter("UNRECORDED", null, null, null)).totalElements());
    for (var group : all.distribution())
      assertEquals(
          group.count(), care.tasks(filter(group.outcome(), null, null, null)).totalElements());
    assertEquals(
        all.counts().completed(),
        all.staff().stream().mapToLong(s -> s.counts().completed()).sum());
    var dated = reports.report(day, day, null);
    assertEquals(6, dated.counts().completed());
    assertEquals(3, dated.counts().recorded());
    assertEquals(3, dated.counts().unrecorded());
    assertEquals(new BigDecimal("33.33"), dated.counts().resolvedRate());
    assertEquals(
        dated.counts().completed(), care.tasks(filter(null, day, day, null)).totalElements());
    assertEquals(
        dated.counts().unrecorded(),
        care.tasks(filter("UNRECORDED", day, day, null)).totalElements());
    assertEquals(
        1,
        care.tasks(
                filter("UNREACHABLE", day, day, null),
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 1, 1))
            .totalElements());
    for (var staff : dated.staff()) {
      var own = reports.report(day, day, staff.id());
      assertEquals(staff.counts(), own.counts());
      assertEquals(
          staff.counts().completed(),
          care.tasks(filter(null, day, day, staff.id())).totalElements());
    }
  }

  @Test
  void emptyUnknownOnlyAndInactiveStaffRemainVisible() {
    assertEquals(new BigDecimal("0.00"), reports.report(null, null, null).counts().resolvedRate());
    var buyer = user("Buyer", "CUSTOMER");
    var staff = user("Staff", "MANAGER");
    task(buyer, staff, null, null);
    staff.setDeletedAt(Instant.now());
    staff.setRole("CUSTOMER");
    em.flush();
    var all = reports.report(null, null, null);
    assertEquals(1, all.counts().completed());
    assertEquals(0, all.counts().recorded());
    assertEquals(1, all.counts().unrecorded());
    assertEquals(new BigDecimal("0.00"), all.counts().resolvedRate());
    assertFalse(all.staff().getFirst().active());
    assertEquals(0, reports.report(day, null, null).counts().completed());
    assertEquals(0, reports.report(null, day, null).counts().completed());
  }

  @Test
  void managerOnlyAndInvalidFiltersRejected() throws Exception {
    var manager = user("Manager", "MANAGER");
    var admin = user("Admin", "ADMIN");
    var buyer = user("Buyer", "CUSTOMER");
    String auth = "Bearer " + jwt.issue(manager.getId(), "MANAGER");
    mvc.perform(get("/api/manager/care/outcomes")).andExpect(status().isUnauthorized());
    for (User wrong : new User[] {admin, buyer})
      mvc.perform(
              get("/api/manager/care/outcomes")
                  .header("Authorization", "Bearer " + jwt.issue(wrong.getId(), wrong.getRole())))
          .andExpect(status().isForbidden());
    String body =
        mvc.perform(get("/api/manager/care/outcomes").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.counts.completed").value(0))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertFalse(body.contains("password"));
    assertFalse(body.contains("resultNote"));
    assertFalse(body.contains("email"));
    for (String q : new String[] {"from=2026-10-16&to=2026-10-15", "assigneeId=-1", "from=invalid"})
      mvc.perform(get("/api/manager/care/outcomes?" + q).header("Authorization", auth))
          .andExpect(status().isBadRequest());
    for (String q :
        new String[] {
          "outcome=BAD", "completedFrom=2026-10-16&completedTo=2026-10-15", "completedTo=invalid"
        })
      mvc.perform(get("/api/manager/care/tasks?" + q).header("Authorization", auth))
          .andExpect(status().isBadRequest());
  }
}
