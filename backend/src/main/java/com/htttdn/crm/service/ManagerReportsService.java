package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;

@Service
public class ManagerReportsService {
    static final ZoneId REPORT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String INCOME_AT = "CASE WHEN o.payment_method = 'COD' "
            + "THEN COALESCE(o.cod_collected_at, o.created_at) ELSE o.created_at END";
    private static final String CAPTURED_ORDER = "o.status <> 'CANCELLED' AND "
            + "(o.payment_status = 'PAID' OR "
            + "(o.payment_method = 'COD' AND o.cod_collected_at IS NOT NULL))";
    private static final String UNKNOWN_EMPLOYEE = "Hệ thống / Không xác định";
    private final NamedParameterJdbcTemplate db;

    public ManagerReportsService(NamedParameterJdbcTemplate db) {
        this.db = db;
    }

    static PeriodWindow periodWindow(Integer requestedYear, Integer month, Clock clock) {
        int year = requestedYear == null
                ? clock.instant().atZone(REPORT_ZONE).getYear()
                : requestedYear;
        if (year < 1900 || year > 9999 || month != null && (month < 1 || month > 12)) {
            throw invalidPeriod();
        }

        LocalDate startDate = month == null
                ? LocalDate.of(year, 1, 1)
                : YearMonth.of(year, month).atDay(1);
        LocalDate endDate = month == null
                ? startDate.plusYears(1)
                : YearMonth.of(year, month).plusMonths(1).atDay(1);
        return new PeriodWindow(year, month, startDate.atStartOfDay(REPORT_ZONE).toInstant(),
                endDate.atStartOfDay(REPORT_ZONE).toInstant());
    }

    static List<TrendBucket> trendBuckets(int year, Integer month) {
        if (year < 1900 || year > 9999 || month != null && (month < 1 || month > 12)) {
            throw invalidPeriod();
        }
        int count = month == null ? 12 : YearMonth.of(year, month).lengthOfMonth();
        List<TrendBucket> buckets = new ArrayList<>(count);
        for (int value = 1; value <= count; value++) {
            String label = month == null
                    ? "Tháng " + value
                    : String.format(Locale.ROOT, "%02d/%02d", value, month);
            buckets.add(new TrendBucket(label, BigDecimal.ZERO, BigDecimal.ZERO));
        }
        return buckets;
    }

    public ReportView report(Integer requestedYear, Integer month) {
        PeriodWindow window = periodWindow(requestedYear, month, Clock.system(REPORT_ZONE));
        Map<String, Object> args = periodArgs(window);
        Summary summary = summary(args);
        List<Integer> availableYears = availableYears(window.year());
        List<TrendBucket> trend = trend(window, args);
        List<ProductVariant> topProducts = topProducts(args);
        List<CustomerSpend> topCustomers = topCustomers(args);
        List<EmployeeActivity> employeeActivities = employeeActivities(args);
        return new ReportView(window.year(), window.month(), availableYears, summary, trend,
                topProducts, topCustomers, employeeActivities);
    }

    private Summary summary(Map<String, Object> args) {
        String incomeAmount = "CASE WHEN o.payment_method = 'COD' "
                + "THEN COALESCE(o.cod_collected_amount, o.total_amount) ELSE o.total_amount END";
        Map<String, Object> income = db.queryForMap("SELECT COALESCE(SUM(" + incomeAmount + "), 0) AS amount, "
                + "COUNT(*) AS transaction_count FROM orders o WHERE " + CAPTURED_ORDER
                + " AND " + INCOME_AT + " >= :from AND " + INCOME_AT + " < :to", args);
        Map<String, Object> expenses = db.queryForMap("SELECT COALESCE(SUM(r.total_cost), 0) AS amount, "
                + "COUNT(*) AS transaction_count FROM stock_receipts r WHERE r.received_at >= :from AND r.received_at < :to", args);
        BigDecimal totalIncome = decimal(income.get("amount"));
        BigDecimal totalExpense = decimal(expenses.get("amount"));
        return new Summary(totalIncome, totalExpense, totalIncome.subtract(totalExpense),
                number(income.get("transaction_count")), number(expenses.get("transaction_count")));
    }

    private List<Integer> availableYears(int currentYear) {
        String orderYear = "CAST(EXTRACT(YEAR FROM (" + INCOME_AT
                + " AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS INTEGER)";
        String receiptYear = "CAST(EXTRACT(YEAR FROM (r.received_at AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS INTEGER)";
        List<Map<String, Object>> rows = db.queryForList("SELECT report_year FROM (SELECT " + orderYear
                + " AS report_year FROM orders o WHERE " + CAPTURED_ORDER + " UNION SELECT " + receiptYear
                + " AS report_year FROM stock_receipts r) years ORDER BY report_year DESC", Map.of());
        TreeSet<Integer> sorted = new TreeSet<>(Comparator.reverseOrder());
        for (Map<String, Object> row : rows) sorted.add(Math.toIntExact(number(row.get("report_year"))));
        sorted.add(currentYear);
        List<Integer> result = new ArrayList<>(sorted);
        result.remove(Integer.valueOf(currentYear));
        result.add(0, currentYear);
        return result;
    }

    private List<TrendBucket> trend(PeriodWindow window, Map<String, Object> args) {
        String part = window.month() == null ? "MONTH" : "DAY";
        String incomeBucket = "CAST(EXTRACT(" + part + " FROM (" + INCOME_AT
                + " AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS INTEGER)";
        String expenseBucket = "CAST(EXTRACT(" + part + " FROM (r.received_at AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS INTEGER)";
        String incomeAmount = "CASE WHEN o.payment_method = 'COD' "
                + "THEN COALESCE(o.cod_collected_amount, o.total_amount) ELSE o.total_amount END";
        Map<Integer, BigDecimal> income = aggregates("SELECT " + incomeBucket + " AS bucket, "
                + "COALESCE(SUM(" + incomeAmount + "), 0) AS amount FROM orders o WHERE " + CAPTURED_ORDER
                + " AND " + INCOME_AT + " >= :from AND " + INCOME_AT + " < :to GROUP BY bucket", args);
        Map<Integer, BigDecimal> expense = aggregates("SELECT " + expenseBucket + " AS bucket, "
                + "COALESCE(SUM(r.total_cost), 0) AS amount FROM stock_receipts r WHERE r.received_at >= :from "
                + "AND r.received_at < :to GROUP BY bucket", args);

        List<TrendBucket> result = new ArrayList<>();
        List<TrendBucket> emptyBuckets = trendBuckets(window.year(), window.month());
        for (int index = 0; index < emptyBuckets.size(); index++) {
            int bucket = index + 1;
            TrendBucket empty = emptyBuckets.get(index);
            result.add(new TrendBucket(empty.label(), income.getOrDefault(bucket, BigDecimal.ZERO),
                    expense.getOrDefault(bucket, BigDecimal.ZERO)));
        }
        return result;
    }

    private Map<Integer, BigDecimal> aggregates(String sql, Map<String, Object> args) {
        Map<Integer, BigDecimal> values = new HashMap<>();
        for (Map<String, Object> row : db.queryForList(sql, args)) {
            values.put(Math.toIntExact(number(row.get("bucket"))), decimal(row.get("amount")));
        }
        return values;
    }

    private List<ProductVariant> topProducts(Map<String, Object> args) {
        String sql = "SELECT p.product_id, p.name AS product_name, c.name AS category_name, i.color, i.size, "
                + "COALESCE(SUM(i.quantity), 0) AS quantity_sold, "
                + "COALESCE(SUM(i.quantity * i.unit_price), 0) AS total_revenue "
                + "FROM orders o JOIN order_items i ON i.order_id = o.order_id "
                + "JOIN products p ON p.product_id = i.product_id "
                + "JOIN categories c ON c.category_id = p.category_id WHERE " + CAPTURED_ORDER
                + " AND " + INCOME_AT + " >= :from AND " + INCOME_AT + " < :to "
                + "GROUP BY p.product_id, p.name, c.name, i.color, i.size "
                + "ORDER BY total_revenue DESC, quantity_sold DESC, p.product_id ASC LIMIT 10";
        return db.queryForList(sql, args).stream().map(row -> new ProductVariant(number(row.get("product_id")),
                string(row.get("product_name")), string(row.get("category_name")), string(row.get("color")),
                string(row.get("size")), number(row.get("quantity_sold")), decimal(row.get("total_revenue")))).toList();
    }

    private List<CustomerSpend> topCustomers(Map<String, Object> args) {
        String amount = "CASE WHEN o.payment_method = 'COD' "
                + "THEN COALESCE(o.cod_collected_amount, o.total_amount) ELSE o.total_amount END";
        String sql = "SELECT c.customer_id, c.full_name, c.email, COUNT(*) AS order_count, "
                + "COALESCE(SUM(" + amount + "), 0) AS total_spent FROM orders o "
                + "JOIN customers c ON c.customer_id = o.customer_id WHERE " + CAPTURED_ORDER
                + " AND " + INCOME_AT + " >= :from AND " + INCOME_AT + " < :to "
                + "GROUP BY c.customer_id, c.full_name, c.email "
                + "ORDER BY total_spent DESC, order_count DESC, c.customer_id ASC LIMIT 10";
        return db.queryForList(sql, args).stream().map(row -> new CustomerSpend(number(row.get("customer_id")),
                string(row.get("full_name")), string(row.get("email")), number(row.get("order_count")),
                decimal(row.get("total_spent")))).toList();
    }

    private List<EmployeeActivity> employeeActivities(Map<String, Object> args) {
        String creatorId = "CASE WHEN u.customer_id IS NULL THEN NULL ELSE r.created_by END";
        String fullName = "CASE WHEN u.customer_id IS NULL THEN '" + UNKNOWN_EMPLOYEE + "' ELSE u.full_name END";
        String email = "CASE WHEN u.customer_id IS NULL THEN NULL ELSE u.email END";
        String sql = "SELECT " + creatorId + " AS employee_id, " + fullName + " AS full_name, " + email
                + " AS email, COUNT(*) AS receipt_count, COALESCE(SUM(r.total_cost), 0) AS total_receipt_cost "
                + "FROM stock_receipts r LEFT JOIN customers u ON u.customer_id = r.created_by "
                + "WHERE r.received_at >= :from AND r.received_at < :to GROUP BY " + creatorId + ", " + fullName
                + ", " + email + " ORDER BY total_receipt_cost DESC, receipt_count DESC, full_name ASC";
        return db.queryForList(sql, args).stream().map(row -> new EmployeeActivity(nullableNumber(row.get("employee_id")),
                string(row.get("full_name")), string(row.get("email")), number(row.get("receipt_count")),
                decimal(row.get("total_receipt_cost")))).toList();
    }

    private static Map<String, Object> periodArgs(PeriodWindow window) {
        Map<String, Object> args = new LinkedHashMap<>();
        args.put("from", window.fromInclusive());
        args.put("to", window.toExclusive());
        return args;
    }

    private static BigDecimal decimal(Object value) {
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return new BigDecimal(number.toString());
        return BigDecimal.ZERO;
    }

    private static long number(Object value) {
        if (value instanceof Number number) return number.longValue();
        return 0;
    }

    private static Long nullableNumber(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static String string(Object value) {
        return value == null ? null : value.toString();
    }

    private static ApiException invalidPeriod() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REPORT_PERIOD", "Năm hoặc tháng báo cáo không hợp lệ.");
    }

    record PeriodWindow(int year, Integer month, Instant fromInclusive, Instant toExclusive) {}

    public record Summary(BigDecimal totalIncome, BigDecimal totalExpense, BigDecimal netBalance,
                          long paidOrdersCount, long stockReceiptsCount) {}

    public record TrendBucket(String label, BigDecimal income, BigDecimal expense) {}

    public record ProductVariant(Long productId, String productName, String categoryName, String color, String size,
                                 long quantitySold, BigDecimal totalRevenue) {}

    public record CustomerSpend(Long customerId, String fullName, String email, long orderCount,
                                BigDecimal totalSpent) {}

    public record EmployeeActivity(Long employeeId, String fullName, String email, long receiptCount,
                                   BigDecimal totalReceiptCost) {}

    public record ReportView(int year, Integer month, List<Integer> availableYears, Summary summary,
                             List<TrendBucket> trend, List<ProductVariant> topProducts,
                             List<CustomerSpend> topCustomers, List<EmployeeActivity> employeeActivities) {}
}
