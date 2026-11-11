package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CashflowReportService {
  private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final String RECEIPTS =
      "WITH receipts AS (SELECT order_id,status,CASE WHEN payment_method='PAYOS' THEN total_amount"
          + " ELSE cod_collected_amount END AS amount,CASE WHEN payment_method='PAYOS' THEN paid_at"
          + " ELSE cod_collected_at END AS confirmed_at FROM orders WHERE (payment_method='PAYOS'"
          + " AND payment_status='PAID' AND total_amount>0) OR (payment_method='COD' AND"
          + " cod_collected_at IS NOT NULL AND cod_collected_amount>0)) ";

  // Aggregate to Vietnam calendar days in SQL (at most 367 rows); month rollup is bounded in Java.
  private static String day(String column) {
    return "CAST(FLOOR((EXTRACT(EPOCH FROM " + column + ")+25200)/86400) AS BIGINT)";
  }

  private final NamedParameterJdbcTemplate db;

  public CashflowReportService(NamedParameterJdbcTemplate db) {
    this.db = db;
  }

  public record Series(
      String period,
      BigDecimal collected,
      BigDecimal refunded,
      BigDecimal net,
      long collectedOrders) {}

  public record Product(Long productId, String name, long quantity, BigDecimal grossItemValue) {}

  public record Unknown(long orders, BigDecimal amount) {}

  public record View(
      Instant from,
      Instant to,
      String groupBy,
      String timezone,
      BigDecimal collected,
      BigDecimal refunded,
      BigDecimal net,
      long collectedOrders,
      List<Series> series,
      List<Product> topProducts,
      Unknown unknownMilestone,
      Instant updatedAt) {}

  private static class Bucket {
    BigDecimal collected = BigDecimal.ZERO, refunded = BigDecimal.ZERO;
    long orders;
  }

  public View report(Instant from, Instant to, String groupBy) {
    if (from == null && to == null) {
      LocalDate today = LocalDate.now(ZONE);
      from = today.minusDays(29).atStartOfDay(ZONE).toInstant();
      to = today.plusDays(1).atStartOfDay(ZONE).toInstant();
    }
    if (from == null
        || to == null
        || !from.isBefore(to)
        || Duration.between(from, to).compareTo(Duration.ofDays(366)) > 0
        || !Set.of("day", "month").contains(groupBy))
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "INVALID_CASHFLOW_RANGE",
          "Chọn khoảng ngày hợp lệ tối đa 366 ngày và nhóm theo ngày/tháng.");
    var args = Map.<String, Object>of("from", Timestamp.from(from), "to", Timestamp.from(to));
    Map<String, Bucket> buckets = new LinkedHashMap<>();
    LocalDate first = from.atZone(ZONE).toLocalDate(),
        last = to.minusNanos(1).atZone(ZONE).toLocalDate();
    for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1))
      buckets.computeIfAbsent(key(d, groupBy), ignored -> new Bucket());
    String receiptDay = day("confirmed_at"), refundDay = day("processed_at");
    db.query(
        RECEIPTS
            + "SELECT "
            + receiptDay
            + " AS bucket,COUNT(*) AS count,SUM(amount) AS amount FROM receipts WHERE"
            + " confirmed_at>=:from AND confirmed_at<:to GROUP BY "
            + receiptDay,
        args,
        r -> {
          var b = buckets.get(key(LocalDate.ofEpochDay(r.getLong("bucket")), groupBy));
          b.collected = b.collected.add(r.getBigDecimal("amount"));
          b.orders += r.getLong("count");
        });
    db.query(
        "SELECT "
            + refundDay
            + " AS bucket,SUM(amount) AS amount FROM order_refunds WHERE status='COMPLETED' AND"
            + " processed_at>=:from AND processed_at<:to GROUP BY "
            + refundDay,
        args,
        r -> {
          var b = buckets.get(key(LocalDate.ofEpochDay(r.getLong("bucket")), groupBy));
          b.refunded = b.refunded.add(r.getBigDecimal("amount"));
        });
    var series =
        buckets.entrySet().stream()
            .map(
                e -> {
                  var b = e.getValue();
                  return new Series(
                      e.getKey(),
                      b.collected,
                      b.refunded,
                      b.collected.subtract(b.refunded),
                      b.orders);
                })
            .toList();
    BigDecimal
        collected = series.stream().map(Series::collected).reduce(BigDecimal.ZERO, BigDecimal::add),
        refunded = series.stream().map(Series::refunded).reduce(BigDecimal.ZERO, BigDecimal::add);
    var top =
        db.query(
            RECEIPTS
                + "SELECT i.product_id,COALESCE(p.name,'Sản phẩm đã lưu') AS name,SUM(i.quantity)"
                + " AS quantity,SUM(i.quantity*i.unit_price) AS gross FROM receipts r JOIN"
                + " order_items i ON i.order_id=r.order_id LEFT JOIN products p ON"
                + " p.product_id=i.product_id WHERE r.confirmed_at>=:from AND r.confirmed_at<:to"
                + " AND r.status<>'CANCELLED' GROUP BY i.product_id,p.name ORDER BY quantity"
                + " DESC,i.product_id ASC LIMIT 10",
            args,
            (r, n) ->
                new Product(
                    r.getLong("product_id"),
                    r.getString("name"),
                    r.getLong("quantity"),
                    r.getBigDecimal("gross")));
    Unknown unknown =
        db.queryForObject(
            "SELECT COUNT(*) AS count,COALESCE(SUM(total_amount),0) AS amount FROM orders WHERE"
                + " payment_method='PAYOS' AND payment_status='PAID' AND paid_at IS NULL AND"
                + " total_amount>0",
            Map.of(),
            (r, n) -> new Unknown(r.getLong("count"), r.getBigDecimal("amount")));
    return new View(
        from,
        to,
        groupBy,
        ZONE.getId(),
        collected,
        refunded,
        collected.subtract(refunded),
        series.stream().mapToLong(Series::collectedOrders).sum(),
        series,
        top,
        unknown,
        Instant.now());
  }

  private static String key(LocalDate d, String group) {
    return group.equals("month") ? YearMonth.from(d).toString() : d.toString();
  }
}
