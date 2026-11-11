package com.htttdn.crm.service;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    name = "crm.care-reminders.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class CareReminderScheduler {
  private static final Logger LOG = LoggerFactory.getLogger(CareReminderScheduler.class);
  private final JdbcTemplate db;
  private final CareReminderService reminders;
  private boolean warned;

  public CareReminderScheduler(JdbcTemplate db, CareReminderService reminders) {
    this.db = db;
    this.reminders = reminders;
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 60000)
  public void tick() {
    try {
      Long fields =
          db.queryForObject(
              "select count(*) from information_schema.columns where table_schema=current_schema()"
                  + " and lower(table_name)='customer_notifications' and lower(column_name) in"
                  + " ('care_task_id','care_due_at')",
              Long.class);
      if (fields == null || fields < 2) {
        if (!warned)
          LOG.warn(
              "Care reminders require database/migrations/015_care_reminders.sql; no schema changes"
                  + " were performed.");
        warned = true;
        return;
      }
      reminders.runOnce(Instant.now());
      warned = false;
    } catch (RuntimeException failure) {
      if (!warned)
        LOG.warn(
            "Care reminders could not refresh; retrying next minute ({})",
            failure.getClass().getSimpleName());
      warned = true;
    }
  }
}
