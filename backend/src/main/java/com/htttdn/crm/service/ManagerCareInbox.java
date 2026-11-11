package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ManagerCareInbox {
  private final JdbcTemplate db;

  public ManagerCareInbox(JdbcTemplate db) {
    this.db = db;
  }

  public record Summary(Map<String, Long> counts, Instant asOf) {}

  public record Notification(
      long id,
      String title,
      String content,
      String type,
      Long taskId,
      Instant dueAt,
      Instant readAt,
      Instant createdAt,
      boolean applicable,
      String state,
      Long ticketId) {}

  public record Notifications(CustomerProfileService.Page<Notification> page, long unreadCount) {}

  private static final String JOINS =
      " from customer_notifications n left join customer_care_tasks t on t.id=n.care_task_id left"
          + " join support_tickets s on s.id=n.support_ticket_id join customers c on"
          + " c.customer_id=coalesce(t.customer_id,s.customer_id) join customers a on"
          + " a.customer_id=n.customer_id";
  private static final String SCOPE =
      "n.customer_id=? and n.type in ('CARE_DUE_TODAY','CARE_OVERDUE','SUPPORT_ASSIGNED')";
  private static final String CURRENT =
      CareReminderRules.OPEN
          + " and "
          + CareReminderRules.CUSTOMER
          + " and "
          + CareReminderRules.ACTIVE
          + " and t.assignee_id=n.customer_id and t.due_at=n.care_due_at";
  private static final String TIMING =
      "((n.type='CARE_OVERDUE' and t.due_at<?) or (n.type='CARE_DUE_TODAY' and t.due_at>=? and"
          + " t.due_at<?))";
  private static final String APPLICABLE =
      "(("
          + CURRENT
          + " and "
          + TIMING
          + ") or (n.type='SUPPORT_ASSIGNED' and s.assignee_id=n.customer_id and"
          + " s.status<>'RESOLVED' and "
          + CareReminderRules.CUSTOMER
          + " and "
          + CareReminderRules.ACTIVE
          + "))";

  private Object[] timing(long manager, Instant now) {
    return new Object[] {
      manager,
      CareReminderRules.timestamp(now),
      CareReminderRules.timestamp(now),
      CareReminderRules.timestamp(CareReminderRules.tomorrow(now))
    };
  }

  public Summary summary(long manager, Instant now) {
    Map<String, Long> counts = new LinkedHashMap<>();
    for (String group : CareReminderRules.GROUPS) {
      var args = new ArrayList<Object>();
      args.add(manager);
      String condition = CareReminderRules.group(group, now, args);
      counts.put(
          group,
          db.queryForObject(
              "select count(*) from customer_care_tasks t join customers c on"
                  + " c.customer_id=t.customer_id where t.assignee_id=? and "
                  + CareReminderRules.CUSTOMER
                  + " and "
                  + condition,
              Long.class,
              args.toArray()));
    }
    return new Summary(counts, now);
  }

  public long unread(long manager, Instant now) {
    return db.queryForObject(
        "select count(*)" + JOINS + " where " + SCOPE + " and n.read_at is null and " + APPLICABLE,
        Long.class,
        timing(manager, now));
  }

  private void page(int page, int size) {
    if (page < 0 || size < 1 || size > 100)
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "Phân trang không hợp lệ.");
  }

  public Notifications notifications(long manager, int page, int size, Instant now) {
    page(page, size);
    long count =
        db.queryForObject("select count(*)" + JOINS + " where " + SCOPE, Long.class, manager);
    var args = new ArrayList<Object>();
    args.add(CareReminderRules.timestamp(now));
    args.add(CareReminderRules.timestamp(now));
    args.add(CareReminderRules.timestamp(CareReminderRules.tomorrow(now)));
    args.add(manager);
    args.add(size);
    args.add((long) page * size);
    var rows =
        db.query(
            "select n.*,coalesce(t.status,s.status) status,case when "
                + APPLICABLE
                + " then true else false end applicable"
                + JOINS
                + " where "
                + SCOPE
                + " order by n.created_at desc,n.id desc limit ? offset ?",
            (r, i) -> {
              boolean applicable = r.getBoolean("applicable");
              String state =
                  Set.of("COMPLETED", "RESOLVED").contains(r.getString("status"))
                      ? "COMPLETED"
                      : applicable ? "ACTIVE" : "OUTDATED";
              var read = r.getTimestamp("read_at");
              var due = r.getTimestamp("care_due_at");
              return new Notification(
                  r.getLong("id"),
                  r.getString("title"),
                  r.getString("content"),
                  r.getString("type"),
                  (Long) r.getObject("care_task_id"),
                  due == null ? null : due.toInstant(),
                  read == null ? null : read.toInstant(),
                  r.getTimestamp("created_at").toInstant(),
                  applicable,
                  state,
                  (Long) r.getObject("support_ticket_id"));
            },
            args.toArray());
    return new Notifications(
        new CustomerProfileService.Page<>(rows, count, (count + size - 1) / size, page, size),
        unread(manager, now));
  }

  @Transactional
  public void read(long manager, long id, Instant now) {
    int updated =
        db.update(
            "update customer_notifications set read_at=coalesce(read_at,?) where id=? and"
                + " customer_id=? and (care_task_id is not null or support_ticket_id is not null)"
                + " and type in ('CARE_DUE_TODAY','CARE_OVERDUE','SUPPORT_ASSIGNED')",
            CareReminderRules.timestamp(now),
            id,
            manager);
    if (updated == 0)
      throw new ApiException(
          HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.");
  }

  @Transactional
  public void readAll(long manager, Instant now) {
    db.update(
        "update customer_notifications set read_at=? where customer_id=? and (care_task_id is not"
            + " null or support_ticket_id is not null) and type in"
            + " ('CARE_DUE_TODAY','CARE_OVERDUE','SUPPORT_ASSIGNED') and read_at is null",
        CareReminderRules.timestamp(now),
        manager);
  }
}
