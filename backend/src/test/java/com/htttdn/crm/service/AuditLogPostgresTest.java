package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.entity.AuditLog;
import com.htttdn.crm.repository.AuditLogRepository;
import java.nio.file.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.*;

@EnabledIfEnvironmentVariable(named = "CRM_POSTGRES_QA", matches = "true")
@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=none"})
@Transactional
class AuditLogPostgresTest {
  @Autowired JdbcTemplate db;
  @Autowired AuditLogRepository logs;
  @Autowired AuditLogQuery query;

  @Test
  void migrationAndQueryOnPostgresRollback() throws Exception {
    try (var connection = db.getDataSource().getConnection()) {
      assertTrue(connection.getMetaData().getURL().startsWith("jdbc:postgresql:"));
    }
    // Keep DDL and test rows inside the test transaction, never commit the migration here.
    String sql =
        Files.readString(Path.of("../database/migrations/016_audit_logs.sql"))
            .replace("BEGIN;", "")
            .replace("COMMIT;", "");
    for (String statement : sql.split(";")) if (!statement.isBlank()) db.execute(statement);
    // Re-running the additive migration is safe.
    for (String statement : sql.split(";")) if (!statement.isBlank()) db.execute(statement);
    String name = "audit-qa-" + UUID.randomUUID();
    logs.saveAndFlush(
        new AuditLog(
            999999L,
            name,
            "MANAGER",
            "STOCK",
            "PRODUCT",
            999999L,
            "{\"stock\":1}",
            "{\"stock\":2}"));
    var request = new MockHttpServletRequest();
    request.setAttribute(AuditTrail.ACTOR_ATTRIBUTE, new AuditTrail.Actor(999999L, name, "ADMIN"));
    RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    try {
      var result = query.list(name, "PRODUCT", "STOCK", null, null, 0, 1);
      assertEquals(1, result.totalElements());
      assertEquals(2, result.content().getFirst().afterData().get("stock").asInt());
    } finally {
      RequestContextHolder.resetRequestAttributes();
    }
  }
}
