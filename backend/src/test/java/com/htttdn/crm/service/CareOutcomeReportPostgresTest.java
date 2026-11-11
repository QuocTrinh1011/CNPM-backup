package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.entity.*;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@EnabledIfEnvironmentVariable(named = "CRM_POSTGRES_QA", matches = "true")
@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=none"})
@Transactional
class CareOutcomeReportPostgresTest {
  @Autowired JdbcTemplate db;
  @Autowired EntityManager em;
  @Autowired CareOutcomeReportService report;
  @Autowired CustomerCareService care;

  User user(String role) {
    var u = new User();
    u.setFullName("Report QA");
    u.setEmail("report-qa-" + java.util.UUID.randomUUID() + "@example.test");
    u.setPasswordHash("qa-not-a-login");
    u.setRole(role);
    em.persist(u);
    em.flush();
    return u;
  }

  @Test
  void postgresReportAndDrilldownMatchWithoutSchemaChanges() {
    Long ready =
        db.queryForObject(
            "select count(*) from information_schema.columns where table_schema=current_schema()"
                + " and table_name='customer_care_tasks' and column_name in"
                + " ('outcome','result_note','parent_task_id','source_type','source_id')",
            Long.class);
    Assumptions.assumeTrue(
        ready == 5,
        "Existing care source/outcome migrations must already be installed; this report test never"
            + " changes schema.");
    var buyer = user("CUSTOMER");
    buyer.setLocked(true);
    var staff = user("MANAGER");
    LocalDate day = LocalDate.of(2026, 10, 15);
    Instant start = day.atStartOfDay(CustomerLifecycle.ZONE).toInstant();
    String[] outcomes = {"CONTACTED", "RESOLVED", "UNREACHABLE", null, "", "INVALID"};
    for (String outcome : outcomes) {
      var t = new CustomerCareTask();
      t.customerId = buyer.getId();
      t.assigneeId = staff.getId();
      t.title = "Report QA";
      t.description = "";
      t.status = "COMPLETED";
      t.outcome = outcome;
      t.dueAt = start.plusSeconds(86400 * 30);
      t.completedAt = start;
      t.createdAt = start;
      t.updatedAt = start;
      t.createdBy = staff.getId();
      t.updatedBy = staff.getId();
      em.persist(t);
    }
    em.flush();
    var result = report.report(day, day, staff.getId());
    assertEquals(6, result.counts().completed());
    assertEquals(3, result.counts().recorded());
    assertEquals(3, result.counts().unrecorded());
    assertEquals(new BigDecimal("33.33"), result.counts().resolvedRate());
    var filters =
        new CustomerCareService.Filters(
            "", null, staff.getId(), "COMPLETED", null, 1, 2, null, null, "UNRECORDED", day, day);
    var list = care.tasks(filters);
    assertEquals(3, list.totalElements());
    assertEquals(1, list.content().size());
    assertEquals(2, list.totalPages());
    long raw =
        db.queryForObject(
            "select count(*) from customer_care_tasks where assignee_id=? and status='COMPLETED'"
                + " and completed_at>=? and completed_at<?",
            Long.class,
            staff.getId(),
            java.sql.Timestamp.from(start),
            java.sql.Timestamp.from(start.plusSeconds(86400)));
    assertEquals(raw, result.counts().completed());
  }
}
