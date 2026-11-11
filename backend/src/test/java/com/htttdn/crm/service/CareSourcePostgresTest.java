package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@EnabledIfEnvironmentVariable(named = "CRM_POSTGRES_QA", matches = "true")
@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=none"})
@Transactional
class CareSourcePostgresTest {
  @Autowired JdbcTemplate db;

  @Test
  void migrationRerunAndPartialUniqueIndexWithRollback() throws Exception {
    // DDL and fixture rows are rolled back; do not install a migration permanently during QA.
    try (var connection = db.getDataSource().getConnection()) {
      assertTrue(connection.getMetaData().getURL().startsWith("jdbc:postgresql:"));
    }
    String sql =
        Files.readString(Path.of("../database/migrations/013_care_sources.sql"))
            .replace("BEGIN;", "")
            .replace("COMMIT;", "");
    for (int i = 0; i < 2; i++)
      for (String statement : sql.split(";")) if (!statement.isBlank()) db.execute(statement);
    Long actor =
        db.queryForObject(
            "insert into customers(full_name,email,password_hash,role) values ('Care source"
                + " QA',?,'not-a-login','MANAGER') returning customer_id",
            Long.class,
            "care-source-" + java.util.UUID.randomUUID() + "@example.test");
    Timestamp now = Timestamp.from(Instant.now());
    String insert =
        "insert into"
            + " customer_care_tasks(customer_id,assignee_id,title,description,status,due_at,created_by,updated_by,created_at,updated_at,source_type,source_id)"
            + " values (?,?,'QA','',?,?, ?,?,?,?,'RETURN_ORDER',?) on conflict do nothing";
    long source = System.currentTimeMillis();
    assertEquals(1, db.update(insert, actor, actor, "TODO", now, actor, actor, now, now, source));
    assertEquals(
        0, db.update(insert, actor, actor, "IN_PROGRESS", now, actor, actor, now, now, source));
    db.update(
        "update customer_care_tasks set status='COMPLETED' where source_type='RETURN_ORDER' and"
            + " source_id=?",
        source);
    assertEquals(1, db.update(insert, actor, actor, "TODO", now, actor, actor, now, now, source));
  }
}
