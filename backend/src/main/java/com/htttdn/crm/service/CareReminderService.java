package com.htttdn.crm.service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** One short transaction per task, sharing the task lock used by edits/completion. */
@Service
public class CareReminderService {
  private final JdbcTemplate db;
  private final TransactionTemplate transaction;

  public CareReminderService(JdbcTemplate db, PlatformTransactionManager manager) {
    this.db = db;
    transaction = new TransactionTemplate(manager);
  }

  private record Candidate(long id, long assignee, String title, Instant due) {}

  private static final String SCOPE =
      " from customer_care_tasks t join customers c on c.customer_id=t.customer_id join customers a"
          + " on a.customer_id=t.assignee_id where "
          + CareReminderRules.OPEN
          + " and "
          + CareReminderRules.CUSTOMER
          + " and "
          + CareReminderRules.ACTIVE;
  private static final String TYPE =
      "case when t.due_at<? then 'CARE_OVERDUE' else 'CARE_DUE_TODAY' end";

  public int runOnce(Instant now) {
    // Exclude already-issued reminders before the batch limit so old work cannot starve new work.
    var ids =
        db.queryForList(
            "select t.id"
                + SCOPE
                + " and t.due_at<? and not exists (select 1 from customer_notifications n where"
                + " n.customer_id=t.assignee_id and n.care_task_id=t.id and n.care_due_at=t.due_at"
                + " and n.type="
                + TYPE
                + ") order by t.due_at,t.id limit 500",
            Long.class,
            CareReminderRules.timestamp(CareReminderRules.tomorrow(now)),
            CareReminderRules.timestamp(now));
    int count = 0;
    for (Long id : ids) {
      Integer inserted = transaction.execute(status -> issue(id, now));
      if (inserted != null) count += inserted;
    }
    return count;
  }

  private int issue(long id, Instant now) {
    var locked =
        db.queryForList("select id from customer_care_tasks where id=? for update", Long.class, id);
    if (locked.isEmpty()) return 0;
    var candidates =
        db.query(
            "select t.id,t.assignee_id,t.title,t.due_at" + SCOPE + " and t.id=? and t.due_at<?",
            (r, i) ->
                new Candidate(
                    r.getLong(1), r.getLong(2), r.getString(3), r.getTimestamp(4).toInstant()),
            id,
            CareReminderRules.timestamp(CareReminderRules.tomorrow(now)));
    if (candidates.isEmpty()) return 0;
    var task = candidates.getFirst();
    String type = task.due.isBefore(now) ? "CARE_OVERDUE" : "CARE_DUE_TODAY";
    if (db.queryForObject(
            "select count(*) from customer_notifications where customer_id=? and care_task_id=? and"
                + " type=? and care_due_at=?",
            Long.class,
            task.assignee,
            task.id,
            type,
            CareReminderRules.timestamp(task.due))
        > 0) return 0;
    String title =
        type.equals("CARE_OVERDUE")
            ? "Công việc chăm sóc đã quá hạn"
            : "Công việc chăm sóc đến hạn hôm nay";
    String content =
        task.title
            + " · Hạn: "
            + DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")
                .withZone(CustomerLifecycle.ZONE)
                .format(task.due)
            + " (giờ Việt Nam)";
    return db.update(
        "insert into"
            + " customer_notifications(customer_id,title,content,type,care_task_id,care_due_at,created_at)"
            + " values (?,?,?,?,?,?,?)",
        task.assignee,
        title,
        content,
        type,
        task.id,
        CareReminderRules.timestamp(task.due),
        CareReminderRules.timestamp(now));
  }
}
