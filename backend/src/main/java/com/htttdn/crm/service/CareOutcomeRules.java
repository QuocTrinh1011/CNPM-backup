package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * Shared report/drilldown predicates. Outcomes only describe completed work, never customer counts.
 */
final class CareOutcomeRules {
  static final List<String> OUTCOMES =
      List.of("CONTACTED", "UNREACHABLE", "RESOLVED", "NEEDS_FOLLOW_UP");
  static final String RECORDED =
      "t.outcome in ('CONTACTED','UNREACHABLE','RESOLVED','NEEDS_FOLLOW_UP')";
  static final String UNRECORDED = "(t.outcome is null or not (" + RECORDED + "))";

  private CareOutcomeRules() {}

  static void validate(LocalDate from, LocalDate to) {
    if (from != null && to != null && from.isAfter(to)) throw bad();
  }

  static ApiException bad() {
    return new ApiException(
        HttpStatus.BAD_REQUEST,
        "INVALID_CARE_FILTER",
        "Bộ lọc kết quả hoặc khoảng ngày hoàn thành không hợp lệ.");
  }

  static String dates(LocalDate from, LocalDate to, List<Object> args) {
    validate(from, to);
    String sql = "";
    if (from != null) {
      sql += " and t.completed_at >= ?";
      args.add(Timestamp.from(from.atStartOfDay(CustomerLifecycle.ZONE).toInstant()));
    }
    if (to != null) {
      sql += " and t.completed_at < ?";
      args.add(Timestamp.from(to.plusDays(1).atStartOfDay(CustomerLifecycle.ZONE).toInstant()));
    }
    return sql;
  }
}
