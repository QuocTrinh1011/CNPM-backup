package com.htttdn.crm.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RetentionReportService {
  private final JdbcTemplate db;

  public RetentionReportService(JdbcTemplate db) {
    this.db = db;
  }

  public record Distribution(String stage, long count, BigDecimal percentage) {}

  public record Thresholds(
      int loyalOrders, BigDecimal loyalValue, int dormantDays, String timezone) {}

  public record Report(
      long totalCustomers,
      long purchasingCustomers,
      long repeatCustomers,
      BigDecimal repeatRate,
      BigDecimal completedValue,
      BigDecimal averageCompletedValuePerBuyer,
      long dormantCustomers,
      List<Distribution> distribution,
      Thresholds thresholds,
      Instant updatedAt,
      long resolvedSupportTickets) {}

  public Report report() {
    return report(Instant.now());
  }

  Report report(Instant now) {
    var cutoff =
        now.atZone(CustomerLifecycle.ZONE)
            .toLocalDate()
            .minusDays(CustomerLifecycle.DORMANT_DAYS)
            .plusDays(1)
            .atStartOfDay(CustomerLifecycle.ZONE)
            .toInstant();
    return db.queryForObject(
        CustomerLifecycleQuery.metricsCte()
            + """
            select count(*) total,
              coalesce(sum(case when completed_orders>0 then 1 else 0 end),0) buyers,
              coalesce(sum(case when completed_orders>=2 then 1 else 0 end),0) repeats,
              coalesce(sum(completed_value),0) amount,
              coalesce(sum(case when completed_orders>0 and last_completed_order_at < ? then 1 else 0 end),0) dormant,
              coalesce(sum(case when stage='NO_PURCHASE' then 1 else 0 end),0) no_purchase,
              coalesce(sum(case when stage='FIRST_PURCHASE' then 1 else 0 end),0) first_purchase,
              coalesce(sum(case when stage='RETURNING' then 1 else 0 end),0) returning_count,
              coalesce(sum(case when stage='LOYAL' then 1 else 0 end),0) loyal,
              (select count(*) from support_tickets s join customers c on c.customer_id=s.customer_id
                where s.status='RESOLVED' and c.role='CUSTOMER' and c.deleted_at is null) resolved_support
            from classified
            """,
        (r, row) -> {
          long total = r.getLong("total"),
              buyers = r.getLong("buyers"),
              repeats = r.getLong("repeats");
          BigDecimal amount = r.getBigDecimal("amount");
          var groups = List.of("NO_PURCHASE", "FIRST_PURCHASE", "RETURNING", "LOYAL");
          var counts =
              new long[] {
                r.getLong("no_purchase"),
                r.getLong("first_purchase"),
                r.getLong("returning_count"),
                r.getLong("loyal")
              };
          var distribution = new java.util.ArrayList<Distribution>();
          for (int i = 0; i < groups.size(); i++) {
            distribution.add(
                new Distribution(
                    groups.get(i),
                    counts[i],
                    divide(
                        BigDecimal.valueOf(counts[i]).multiply(BigDecimal.valueOf(100)), total)));
          }
          return new Report(
              total,
              buyers,
              repeats,
              divide(BigDecimal.valueOf(repeats).multiply(BigDecimal.valueOf(100)), buyers),
              amount,
              divide(amount, buyers),
              r.getLong("dormant"),
              List.copyOf(distribution),
              new Thresholds(
                  CustomerLifecycle.LOYAL_ORDERS,
                  CustomerLifecycle.LOYAL_VALUE,
                  CustomerLifecycle.DORMANT_DAYS,
                  CustomerLifecycle.ZONE.getId()),
              now,
              r.getLong("resolved_support"));
        },
        java.sql.Timestamp.from(cutoff));
  }

  private static BigDecimal divide(BigDecimal value, long denominator) {
    return denominator == 0
        ? BigDecimal.ZERO.setScale(2)
        : value.divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
  }
}
