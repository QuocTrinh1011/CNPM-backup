package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;

final class CareReminderRules {
  static final String OPEN = "t.status in ('TODO','IN_PROGRESS')";
  static final String CUSTOMER = "c.role='CUSTOMER' and c.deleted_at is null";
  static final String ACTIVE = "a.role='MANAGER' and a.locked=false and a.deleted_at is null";
  static final List<String> GROUPS = List.of("OPEN", "TODAY", "UPCOMING", "OVERDUE", "FOLLOW_UP");

  static Timestamp timestamp(Instant instant) {
    return Timestamp.from(instant);
  }

  static Instant tomorrow(Instant now) {
    return now.atZone(CustomerLifecycle.ZONE)
        .toLocalDate()
        .plusDays(1)
        .atStartOfDay(CustomerLifecycle.ZONE)
        .toInstant();
  }

  static String group(String group, Instant now, List<Object> args) {
    if (group == null) group = "OPEN";
    if (!GROUPS.contains(group))
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_CARE_FILTER", "Nhóm công việc không hợp lệ.");
    String sql = OPEN;
    switch (group) {
      case "TODAY" -> {
        sql += " and t.due_at>=? and t.due_at<?";
        args.add(timestamp(now));
        args.add(timestamp(tomorrow(now)));
      }
      case "UPCOMING" -> {
        sql += " and t.due_at>=? and t.due_at<?";
        args.add(timestamp(tomorrow(now)));
        args.add(
            timestamp(
                now.atZone(CustomerLifecycle.ZONE)
                    .toLocalDate()
                    .plusDays(8)
                    .atStartOfDay(CustomerLifecycle.ZONE)
                    .toInstant()));
      }
      case "OVERDUE" -> {
        sql += " and t.due_at<?";
        args.add(timestamp(now));
      }
      case "FOLLOW_UP" -> sql += " and t.parent_task_id is not null";
    }
    return sql;
  }

  private CareReminderRules() {}
}
