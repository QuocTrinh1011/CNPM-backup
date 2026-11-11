package com.htttdn.crm.service;

import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CareOutcomeReportService {
  private final JdbcTemplate db;

  public CareOutcomeReportService(JdbcTemplate db) {
    this.db = db;
  }

  public record Counts(
      long completed,
      long recorded,
      long unrecorded,
      long contacted,
      long unreachable,
      long resolved,
      long needsFollowUp,
      BigDecimal resolvedRate) {}

  public record Distribution(String outcome, long count, BigDecimal percentage) {}

  public record Staff(long id, String name, boolean active, Counts counts) {}

  public record Report(
      Counts counts, List<Distribution> distribution, List<Staff> staff, Instant asOf) {}

  private static BigDecimal rate(long value, long total) {
    return total == 0
        ? BigDecimal.ZERO.setScale(2)
        : BigDecimal.valueOf(value)
            .multiply(BigDecimal.valueOf(100))
            .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
  }

  private static Counts counts(
      long completed, long contacted, long unreachable, long resolved, long follow) {
    long recorded = contacted + unreachable + resolved + follow;
    return new Counts(
        completed,
        recorded,
        completed - recorded,
        contacted,
        unreachable,
        resolved,
        follow,
        rate(resolved, recorded));
  }

  public Report report(LocalDate from, LocalDate to, Long assigneeId) {
    CareOutcomeRules.validate(from, to);
    if (assigneeId != null && assigneeId < 1) throw CareOutcomeRules.bad();
    Instant now = Instant.now();
    var args = new ArrayList<Object>();
    String scope =
        " from customer_care_tasks t join customers c on c.customer_id=t.customer_id join customers"
            + " a on a.customer_id=t.assignee_id where t.status='COMPLETED' and c.role='CUSTOMER'"
            + " and c.deleted_at is null"
            + CareOutcomeRules.dates(from, to, args);
    if (assigneeId != null) {
      scope += " and t.assignee_id=?";
      args.add(assigneeId);
    }
    // One database snapshot grouped by assignee; derive totals from these exact rows, without a
    // second query.
    var staff =
        db.query(
            "select a.customer_id,a.full_name,a.role,a.locked,a.deleted_at,count(*) completed,"
                + "sum(case when t.outcome='CONTACTED' then 1 else 0 end) contacted,"
                + "sum(case when t.outcome='UNREACHABLE' then 1 else 0 end) unreachable,"
                + "sum(case when t.outcome='RESOLVED' then 1 else 0 end) resolved,"
                + "sum(case when t.outcome='NEEDS_FOLLOW_UP' then 1 else 0 end) follow"
                + scope
                + " group by a.customer_id,a.full_name,a.role,a.locked,a.deleted_at order by"
                + " a.full_name,a.customer_id",
            (r, n) ->
                new Staff(
                    r.getLong("customer_id"),
                    r.getString("full_name"),
                    "MANAGER".equals(r.getString("role"))
                        && !r.getBoolean("locked")
                        && r.getTimestamp("deleted_at") == null,
                    counts(
                        r.getLong("completed"),
                        r.getLong("contacted"),
                        r.getLong("unreachable"),
                        r.getLong("resolved"),
                        r.getLong("follow"))),
            args.toArray());
    long completed = 0, contacted = 0, unreachable = 0, resolved = 0, follow = 0;
    for (var s : staff) {
      completed += s.counts.completed;
      contacted += s.counts.contacted;
      unreachable += s.counts.unreachable;
      resolved += s.counts.resolved;
      follow += s.counts.needsFollowUp;
    }
    Counts total = counts(completed, contacted, unreachable, resolved, follow);
    long[] values = {contacted, unreachable, resolved, follow};
    var distribution = new ArrayList<Distribution>();
    for (int i = 0; i < values.length; i++)
      distribution.add(
          new Distribution(
              CareOutcomeRules.OUTCOMES.get(i), values[i], rate(values[i], total.recorded)));
    return new Report(total, List.copyOf(distribution), staff, now);
  }
}
