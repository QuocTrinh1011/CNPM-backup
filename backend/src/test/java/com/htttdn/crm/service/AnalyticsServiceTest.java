package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import com.htttdn.crm.exception.ApiException;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class AnalyticsServiceTest {
  JdbcTemplate db;
  AnalyticsService service;

  @BeforeEach
  void setup() {
    db =
        new JdbcTemplate(
            new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                ""));
    service = new AnalyticsService(db);
    db.execute(
        "create table customers(age int,preferences varchar(4000),locked boolean,role"
            + " varchar(20),deleted_at timestamp)");
    db.execute(
        "create table survey_definitions(id bigint,title varchar(255),status varchar(30),created_at"
            + " timestamp,deleted_at timestamp)");
    db.execute(
        "create table survey_questions(id bigint,survey_id bigint,text varchar(1000),type"
            + " varchar(30),options_json varchar(4000),display_order int)");
    db.execute("create table survey_responses(id bigint,survey_id bigint)");
    db.execute(
        "create table survey_answers(id bigint,response_id bigint,question_id bigint,answer"
            + " varchar(4000))");
  }

  @Test
  void customerBoundariesNormalizationAndExclusions() {
    for (int age : new int[] {17, 18, 24, 25, 34, 35, 44, 45, 54, 55})
      db.update("insert into customers values(?,'  Sport   STYLE ',false,'CUSTOMER',null)", age);
    db.update("insert into customers values(null,null,true,'CUSTOMER',null)");
    db.update("insert into customers values(20,'Other',false,'ADMIN',null)");
    db.update("insert into customers values(20,'Other',false,'CUSTOMER',CURRENT_TIMESTAMP)");
    var report = service.customers();
    assertEquals(11L, report.get("total"));
    assertEquals(10L, report.get("knownAge"));
    var ages = (List<AnalyticsService.Bucket>) report.get("ages");
    assertEquals(
        List.of(1L, 2L, 2L, 2L, 2L, 1L, 1L),
        ages.stream().map(AnalyticsService.Bucket::count).toList());
    var preferences = (List<AnalyticsService.Bucket>) report.get("preferences");
    assertEquals("sport style", preferences.get(0).label());
    assertEquals(10, preferences.get(0).count());
  }

  @Test
  void surveyCountsDeduplicateOptionsAndSeparateInvalidAnswers() {
    db.execute("insert into survey_definitions values(1,'Survey','DRAFT',CURRENT_TIMESTAMP,null)");
    db.execute(
        "insert into survey_questions values(10,1,'Choose','MULTIPLE_CHOICE','[\"A\",\"B\"]',0)");
    for (int i = 1; i <= 4; i++) db.update("insert into survey_responses values(?,1)", i);
    db.execute(
        "insert into survey_answers"
            + " values(1,1,10,'[\"A\",\"A\",\"B\"]'),(2,2,10,'broken'),(3,3,10,'[]')");
    var report = service.results(1);
    var questions = (List<Map<String, Object>>) report.get("questions");
    var q = questions.get(0);
    assertEquals(2L, q.get("answered"));
    assertEquals(2L, q.get("skipped"));
    assertEquals(1L, q.get("invalid"));
    var options = (List<AnalyticsService.Bucket>) q.get("options");
    assertEquals(1, options.get(0).count());
    assertEquals(50.0, options.get(0).percent());
    assertFalse(report.toString().contains("customer"));
    db.execute("update survey_definitions set deleted_at=CURRENT_TIMESTAMP");
    assertThrows(ApiException.class, () -> service.results(1));
    assertEquals(0L, service.surveys(0, 10).get("totalElements"));
  }

  @Test
  void emptyReportsAndTextPagination() {
    assertEquals(0L, service.customers().get("total"));
    db.execute(
        "insert into survey_definitions values(1,'Survey','PUBLISHED',CURRENT_TIMESTAMP,null)");
    db.execute("insert into survey_questions values(10,1,'Text','TEXT',null,0)");
    db.execute("insert into survey_responses values(1,1),(2,1)");
    db.execute("insert into survey_answers values(1,1,10,'First'),(2,2,10,'Second')");
    var page = service.textAnswers(1, 10, 1, 1);
    assertEquals(List.of("Second"), page.get("content"));
    assertEquals(2L, page.get("totalElements"));
  }
}
