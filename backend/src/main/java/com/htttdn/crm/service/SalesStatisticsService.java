package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SalesStatisticsService {
  private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final String PAID_ORDERS =
      "WITH paid_orders AS (SELECT o.order_id,o.salesperson_id,CASE WHEN o.payment_method='PAYOS'"
          + " THEN o.total_amount ELSE o.cod_collected_amount END AS amount,CASE WHEN"
          + " o.payment_method='PAYOS' THEN o.paid_at ELSE o.cod_collected_at END AS confirmed_at"
          + " FROM orders o WHERE (o.payment_method='PAYOS' AND o.payment_status='PAID' AND"
          + " o.total_amount>0) OR (o.payment_method='COD' AND o.cod_collected_at IS NOT NULL AND"
          + " o.cod_collected_amount>0)) ";

  private final NamedParameterJdbcTemplate db;

  public SalesStatisticsService(NamedParameterJdbcTemplate db) {
    this.db = db;
  }

  public record StaffOption(Long id, String name) {}

  public record PeriodValue(String period, BigDecimal amount, long orderCount, long quantity) {}

  public record FinancePeriod(
      String period,
      BigDecimal collected,
      BigDecimal inventoryExpense,
      BigDecimal estimatedProfit,
      long collectedOrders) {}

  public record StaffRow(
      Long id, String name, List<PeriodValue> periods, BigDecimal totalRevenue, long orderCount) {}

  public record ProductRow(
      Long id,
      String name,
      List<PeriodValue> periods,
      BigDecimal totalRevenue,
      long orderCount,
      long quantity) {}

  public record UnknownPayment(long orders, BigDecimal amount) {}

  public record View(
      int year,
      String groupBy,
      String timezone,
      List<String> periods,
      List<FinancePeriod> finance,
      BigDecimal totalCollected,
      BigDecimal totalInventoryExpense,
      BigDecimal estimatedProfit,
      long collectedOrders,
      UnknownPayment unknownPayment,
      List<StaffRow> employees,
      List<ProductRow> products,
      java.time.Instant updatedAt) {}

  private static final class Amounts {
    BigDecimal amount = BigDecimal.ZERO;
    long orderCount;
    long quantity;

    void add(BigDecimal value, long orders, long qty) {
      amount = amount.add(value == null ? BigDecimal.ZERO : value);
      orderCount += orders;
      quantity += qty;
    }
  }

  private static final class FinanceAmounts {
    BigDecimal collected = BigDecimal.ZERO;
    BigDecimal expense = BigDecimal.ZERO;
    long orderCount;
  }

  private static final class Breakdown {
    final Long id;
    final String name;
    final Map<String, Amounts> values = new LinkedHashMap<>();

    Breakdown(Long id, String name, List<String> periods) {
      this.id = id;
      this.name = name;
      periods.forEach(period -> values.put(period, new Amounts()));
    }
  }

  public List<StaffOption> staffOptions() {
    return db.query(
        "SELECT customer_id,full_name FROM customers WHERE role='MANAGER' "
            + "AND locked=false AND deleted_at IS NULL ORDER BY full_name,customer_id",
        (r, n) -> new StaffOption(r.getLong("customer_id"), r.getString("full_name")));
  }

  public View report(Integer requestedYear, String requestedGroupBy) {
    String groupBy =
        requestedGroupBy == null || requestedGroupBy.isBlank() ? "quarter" : requestedGroupBy;
    if (!Set.of("month", "quarter", "year").contains(groupBy))
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_REPORT_GROUP", "Chọn nhóm theo tháng, quý hoặc năm.");

    int currentYear = LocalDate.now(ZONE).getYear();
    int year = requestedYear == null ? currentYear : requestedYear;
    if (year < 2000 || year > currentYear + 1)
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_REPORT_YEAR", "Năm báo cáo không hợp lệ.");

    List<String> periods = periods(groupBy, year, currentYear);
    Map<String, FinanceAmounts> finance = finance(periods, groupBy, year);
    Map<Long, Breakdown> employees = new LinkedHashMap<>();
    Map<Long, Breakdown> products = new LinkedHashMap<>();
    db.query(
        "SELECT customer_id,full_name FROM customers WHERE role='MANAGER' ORDER BY"
            + " full_name,customer_id",
        row -> {
          long id = row.getLong("customer_id");
          employees.put(id, new Breakdown(id, row.getString("full_name"), periods));
        });
    // Online orders remain visible until a Manager explicitly assigns a salesperson.
    employees.put(null, new Breakdown(null, "Online / chưa gán nhân viên", periods));
    employeeSales(periods, groupBy, year, employees);
    productSales(periods, groupBy, year, products);

    List<FinancePeriod> financeRows =
        periods.stream()
            .map(
                period -> {
                  FinanceAmounts value = finance.get(period);
                  return new FinancePeriod(
                      period,
                      value.collected,
                      value.expense,
                      value.collected.subtract(value.expense),
                      value.orderCount);
                })
            .toList();
    BigDecimal collected = sum(financeRows.stream().map(FinancePeriod::collected).toList());
    BigDecimal expense = sum(financeRows.stream().map(FinancePeriod::inventoryExpense).toList());
    long orderCount = financeRows.stream().mapToLong(FinancePeriod::collectedOrders).sum();
    UnknownPayment unknown = unknownPayments();
    return new View(
        year,
        groupBy,
        ZONE.getId(),
        periods,
        financeRows,
        collected,
        expense,
        collected.subtract(expense),
        orderCount,
        unknown,
        employeeRows(employees, periods),
        productRows(products, periods),
        java.time.Instant.now());
  }

  private List<String> periods(String groupBy, int year, int currentYear) {
    if ("month".equals(groupBy)) {
      List<String> result = new ArrayList<>();
      for (int month = 1; month <= 12; month++) result.add("%04d-%02d".formatted(year, month));
      return result;
    }
    if ("quarter".equals(groupBy))
      return List.of(year + "-Q1", year + "-Q2", year + "-Q3", year + "-Q4");
    Integer first =
        db.queryForObject(
            "SELECT MIN(y)::int FROM (SELECT EXTRACT(YEAR FROM paid_at AT TIME ZONE :zone) AS y"
                + " FROM orders WHERE paid_at IS NOT NULL UNION ALL SELECT EXTRACT(YEAR FROM"
                + " cod_collected_at AT TIME ZONE :zone) AS y FROM orders WHERE cod_collected_at IS"
                + " NOT NULL UNION ALL SELECT EXTRACT(YEAR FROM received_at AT TIME ZONE :zone) AS"
                + " y FROM stock_receipts WHERE status='POSTED') dates",
            Map.of("zone", ZONE.getId()),
            Integer.class);
    int firstYear = first == null ? currentYear : Math.max(2000, first);
    List<String> result = new ArrayList<>();
    for (int y = firstYear; y <= currentYear; y++) result.add(Integer.toString(y));
    if (result.isEmpty()) result.add(Integer.toString(currentYear));
    return result;
  }

  private String periodExpression(String column, String groupBy) {
    String local = "(" + column + " AT TIME ZONE :zone)";
    return switch (groupBy) {
      case "month" -> "TO_CHAR(" + local + ", 'YYYY-MM')";
      case "quarter" ->
          "EXTRACT(YEAR FROM "
              + local
              + ")::int::text || '-Q' || EXTRACT(QUARTER FROM "
              + local
              + ")::int::text";
      default -> "EXTRACT(YEAR FROM " + local + ")::int::text";
    };
  }

  private Map<String, Object> parameters() {
    return new HashMap<>(Map.of("zone", ZONE.getId()));
  }

  private String timeFilter(String column, String groupBy) {
    return "year".equals(groupBy) ? "" : " AND " + column + ">=:from AND " + column + "<:to";
  }

  private void addBounds(Map<String, Object> args, int year, String groupBy) {
    if ("year".equals(groupBy)) return;
    var from = LocalDate.of(year, 1, 1).atStartOfDay(ZONE).toInstant();
    var to = LocalDate.of(year + 1, 1, 1).atStartOfDay(ZONE).toInstant();
    args.put("from", java.sql.Timestamp.from(from));
    args.put("to", java.sql.Timestamp.from(to));
  }

  private Map<String, FinanceAmounts> finance(List<String> periods, String groupBy, int year) {
    Map<String, FinanceAmounts> result = new LinkedHashMap<>();
    periods.forEach(period -> result.put(period, new FinanceAmounts()));
    Map<String, Object> args = parameters();
    addBounds(args, year, groupBy);
    boolean bounded = !"year".equals(groupBy);
    String paidPeriod = periodExpression("confirmed_at", groupBy);
    String paidFilter = bounded ? " WHERE confirmed_at>=:from AND confirmed_at<:to" : "";
    db.query(
        PAID_ORDERS
            + "SELECT "
            + paidPeriod
            + " AS period,COUNT(*) AS orders,COALESCE(SUM(amount),0) AS amount "
            + "FROM paid_orders"
            + paidFilter
            + " GROUP BY period",
        args,
        row -> {
          FinanceAmounts value = result.get(row.getString("period"));
          if (value != null) {
            value.collected = value.collected.add(row.getBigDecimal("amount"));
            value.orderCount += row.getLong("orders");
          }
        });
    String expensePeriod = periodExpression("received_at", groupBy);
    String expenseFilter = bounded ? " AND received_at>=:from AND received_at<:to" : "";
    db.query(
        "SELECT "
            + expensePeriod
            + " AS period,COALESCE(SUM(total_cost),0) AS amount FROM stock_receipts "
            + "WHERE status='POSTED'"
            + expenseFilter
            + " GROUP BY period",
        args,
        row -> {
          FinanceAmounts value = result.get(row.getString("period"));
          if (value != null) value.expense = value.expense.add(row.getBigDecimal("amount"));
        });
    return result;
  }

  private void employeeSales(
      List<String> periods, String groupBy, int year, Map<Long, Breakdown> rows) {
    Map<String, Object> args = parameters();
    addBounds(args, year, groupBy);
    String paymentPeriod = periodExpression("confirmed_at", groupBy);
    String paymentFilter = timeFilter("confirmed_at", groupBy);
    db.query(
        PAID_ORDERS
            + "SELECT salesperson_id,"
            + paymentPeriod
            + " AS period,COUNT(*) AS orders,COALESCE(SUM(amount),0) AS amount "
            + "FROM paid_orders WHERE confirmed_at IS NOT NULL"
            + paymentFilter
            + " GROUP BY salesperson_id,period",
        args,
        row -> {
          Long id = (Long) row.getObject("salesperson_id");
          Breakdown staff =
              rows.computeIfAbsent(
                  id,
                  key ->
                      new Breakdown(
                          key,
                          id == null ? "Online / chưa gán nhân viên" : "Nhân viên #" + id,
                          periods));
          Amounts value = staff.values.get(row.getString("period"));
          if (value != null) value.add(row.getBigDecimal("amount"), row.getLong("orders"), 0);
        });
  }

  private void productSales(
      List<String> periods, String groupBy, int year, Map<Long, Breakdown> rows) {
    Map<String, Object> args = parameters();
    addBounds(args, year, groupBy);
    String period = periodExpression("p.confirmed_at", groupBy);
    String filter = timeFilter("p.confirmed_at", groupBy);
    String salesSql =
        PAID_ORDERS
            + ", item_gross AS (SELECT order_id,product_id,SUM(quantity::numeric*unit_price) AS"
            + " line_gross,SUM(quantity)::bigint AS quantity FROM order_items GROUP BY"
            + " order_id,product_id), order_gross AS (SELECT order_id,SUM(line_gross) AS gross FROM"
            + " item_gross GROUP BY order_id) SELECT i.product_id,COALESCE(pr.name,'Sản phẩm đã"
            + " lưu') AS name,"
            + period
            + " AS period,COALESCE(SUM(p.amount*i.line_gross/NULLIF(g.gross,0)),0) AS"
            + " amount,SUM(i.quantity)::bigint AS quantity,COUNT(DISTINCT p.order_id) AS orders"
            + " FROM paid_orders p JOIN item_gross i ON i.order_id=p.order_id JOIN order_gross g ON"
            + " g.order_id=p.order_id LEFT JOIN products pr ON pr.product_id=i.product_id WHERE"
            + " p.confirmed_at IS NOT NULL"
            + filter
            + " GROUP BY i.product_id,pr.name,period";
    db.query(
        salesSql,
        args,
        row -> {
          long id = row.getLong("product_id");
          String name = row.getString("name");
          Breakdown product = rows.computeIfAbsent(id, key -> new Breakdown(key, name, periods));
          Amounts value = product.values.get(row.getString("period"));
          if (value != null)
            value.add(row.getBigDecimal("amount"), row.getLong("orders"), row.getLong("quantity"));
        });
  }

  private UnknownPayment unknownPayments() {
    return db.queryForObject(
        "SELECT COUNT(*) AS orders,COALESCE(SUM(total_amount),0) AS amount FROM orders WHERE"
            + " payment_method='PAYOS' AND payment_status='PAID' AND paid_at IS NULL AND"
            + " total_amount>0",
        Map.of(),
        (r, n) -> new UnknownPayment(r.getLong("orders"), r.getBigDecimal("amount")));
  }

  private List<StaffRow> employeeRows(Map<Long, Breakdown> rows, List<String> periods) {
    return rows.values().stream()
        .map(
            row -> {
              List<PeriodValue> values =
                  periods.stream()
                      .map(
                          period -> {
                            Amounts amount = row.values.get(period);
                            return new PeriodValue(period, amount.amount, amount.orderCount, 0);
                          })
                      .toList();
              return new StaffRow(
                  row.id,
                  row.name,
                  values,
                  sum(values.stream().map(PeriodValue::amount).toList()),
                  values.stream().mapToLong(PeriodValue::orderCount).sum());
            })
        .sorted(
            Comparator.comparing((StaffRow row) -> row.id() == null ? Integer.MAX_VALUE : row.id()))
        .toList();
  }

  private List<ProductRow> productRows(Map<Long, Breakdown> rows, List<String> periods) {
    return rows.values().stream()
        .map(
            row -> {
              List<PeriodValue> values =
                  periods.stream()
                      .map(
                          period -> {
                            Amounts amount = row.values.get(period);
                            return new PeriodValue(
                                period, amount.amount, amount.orderCount, amount.quantity);
                          })
                      .toList();
              return new ProductRow(
                  row.id,
                  row.name,
                  values,
                  sum(values.stream().map(PeriodValue::amount).toList()),
                  values.stream().mapToLong(PeriodValue::orderCount).sum(),
                  values.stream().mapToLong(PeriodValue::quantity).sum());
            })
        .sorted(
            Comparator.comparing(ProductRow::totalRevenue)
                .reversed()
                .thenComparing(ProductRow::name))
        .toList();
  }

  private BigDecimal sum(List<BigDecimal> values) {
    return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
  }
}
