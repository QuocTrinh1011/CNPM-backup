package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class InventoryExpenseReportService {
  private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private final NamedParameterJdbcTemplate db;

  public InventoryExpenseReportService(NamedParameterJdbcTemplate db) {
    this.db = db;
  }

  public View byYear(Integer requestedYear) {
    int year = requestedYear == null ? LocalDate.now(ZONE).getYear() : requestedYear;
    int currentYear = LocalDate.now(ZONE).getYear();
    if (year < 2000 || year > currentYear + 1)
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_REPORT_YEAR", "Năm báo cáo không hợp lệ.");
    var start = LocalDate.of(year, 1, 1).atStartOfDay(ZONE).toInstant();
    var end = LocalDate.of(year + 1, 1, 1).atStartOfDay(ZONE).toInstant();
    var args =
        Map.<String, Object>of(
            "from",
            OffsetDateTime.ofInstant(start, ZoneOffset.UTC),
            "to",
            OffsetDateTime.ofInstant(end, ZoneOffset.UTC),
            "zone",
            ZONE.getId());
    Map<Integer, Quarter> quarters = new LinkedHashMap<>();
    for (int quarter = 1; quarter <= 4; quarter++)
      quarters.put(quarter, new Quarter(quarter, BigDecimal.ZERO, 0));
    db.query(
        "SELECT EXTRACT(QUARTER FROM received_at AT TIME ZONE :zone)::int AS quarter, COUNT(*) AS"
            + " receipts, COALESCE(SUM(total_cost),0) AS amount FROM stock_receipts WHERE"
            + " status='POSTED' AND received_at>=:from AND received_at<:to GROUP BY quarter ORDER"
            + " BY quarter",
        args,
        row -> {
          int quarter = row.getInt("quarter");
          quarters.put(
              quarter, new Quarter(quarter, row.getBigDecimal("amount"), row.getLong("receipts")));
        });
    BigDecimal total =
        quarters.values().stream().map(Quarter::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add);
    long count = quarters.values().stream().mapToLong(Quarter::receiptCount).sum();
    return new View(year, ZONE.getId(), total, count, List.copyOf(quarters.values()));
  }

  public record Quarter(int quarter, BigDecimal totalCost, long receiptCount) {}

  public record View(
      int year, String timezone, BigDecimal totalCost, long receiptCount, List<Quarter> quarters) {}
}
