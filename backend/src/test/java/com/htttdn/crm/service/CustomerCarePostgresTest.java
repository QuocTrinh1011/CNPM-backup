package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.transaction.BeforeTransaction;
import org.springframework.transaction.annotation.Transactional;

/** Opt-in local QA: installs the additive migration, then rolls back all sample records. */
@EnabledIfEnvironmentVariable(named = "CRM_CARE_POSTGRES_QA", matches = "true")
@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=none"})
@Transactional
class CustomerCarePostgresTest {
  @Autowired JdbcTemplate db;
  @Autowired EntityManager em;
  @Autowired CustomerCareService service;
  @Autowired JwtTokenService jwt;
  @Autowired CareDashboardService dashboard;

  @BeforeTransaction
  void installAdditiveMigration() throws Exception {
    try (var connection = db.getDataSource().getConnection()) {
      if (!connection.getMetaData().getDatabaseProductName().equals("PostgreSQL"))
        throw new IllegalStateException("QA requires PostgreSQL");
      ScriptUtils.executeSqlScript(
          connection, new FileSystemResource("../database/migrations/012_customer_care.sql"));
      ScriptUtils.executeSqlScript(
          connection,
          new FileSystemResource("../database/migrations/012_customer_care.sql")); // rerun is safe
      ScriptUtils.executeSqlScript(
          connection, new FileSystemResource("../database/migrations/013_care_sources.sql"));
      ScriptUtils.executeSqlScript(
          connection, new FileSystemResource("../database/migrations/014_care_outcomes.sql"));
    }
  }

  User user(String name, String role) {
    var u = new User();
    u.setFullName(name);
    u.setEmail(name + "@example.test");
    u.setPasswordHash("qa-not-a-login");
    u.setRole(role);
    em.persist(u);
    em.flush();
    return u;
  }

  @Test
  void careNotesWorkflowAndQueriesOnPostgresWithRollback() {
    String unique = "care-qa-" + UUID.randomUUID();
    var customer = user(unique, "CUSTOMER");
    var manager = user(unique + "manager", "MANAGER");
    String auth = "Bearer " + jwt.issue(manager.getId(), "MANAGER");
    service.addNote(
        auth, customer.getId(), new CustomerCareService.NoteInput("Ghi chú thử nghiệm rollback"));
    assertEquals(1, service.notes(customer.getId(), 0, 10).totalElements());
    for (int i = 0; i < 15; i++)
      service.create(
          auth,
          new CustomerCareService.CreateTask(
              customer.getId(),
              manager.getId(),
              "Call " + i,
              "QA",
              Instant.now().minusSeconds(60)));
    var f =
        new CustomerCareService.Filters(
            unique, customer.getId(), manager.getId(), "TODO", true, 1, 10);
    var page = service.tasks(f);
    assertEquals(15, page.totalElements());
    assertEquals(5, page.content().size());
    var t = page.content().getFirst();
    var completed =
        service.update(
            auth,
            t.id(),
            new CustomerCareService.UpdateTask(
                t.assigneeId(),
                t.title(),
                t.description(),
                t.dueAt(),
                "COMPLETED",
                t.version(),
                "CONTACTED",
                null));
    assertFalse(completed.overdue());
    assertEquals(14, service.tasks(f).totalElements());
    assertEquals(
        15L,
        db.queryForObject(
            "select count(*) from customer_care_tasks where customer_id=?",
            Long.class,
            customer.getId()));
    var report = dashboard.dashboard(null, null, manager.getId());
    assertEquals(15, report.counts().total());
    assertEquals(14, report.counts().overdue());
    assertEquals(1, report.counts().completed());
    assertEquals(1, report.staff().size());
  }
}
