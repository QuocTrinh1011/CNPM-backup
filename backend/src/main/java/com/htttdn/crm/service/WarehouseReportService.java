package com.htttdn.crm.service;

import com.htttdn.crm.dto.warehouse.WarehouseReportDto;
import com.htttdn.crm.exception.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WarehouseReportService {
    static final ZoneId REPORT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String BALANCES_SQL = """
            WITH report_items AS (
                SELECT 'MATERIAL' AS item_type, material.id AS item_id, material.code AS item_code,
                       material.name AS item_name, material.unit AS unit,
                       'RAW_MATERIAL_AVAILABLE' AS location, CAST(NULL AS BIGINT) AS scope_id
                FROM raw_materials material
                UNION ALL
                SELECT 'MATERIAL', plan_material.material_id, plan_material.material_code,
                       plan_material.material_name, plan_material.unit,
                       'PRODUCTION_ALLOCATED', plan.id
                FROM production_plan_materials plan_material
                JOIN production_plans plan ON plan.id = plan_material.plan_id
                UNION ALL
                SELECT 'PRODUCT', product.product_id, CAST(NULL AS VARCHAR(40)), product.name,
                       CAST(NULL AS VARCHAR(24)), 'FINISHED_WAREHOUSE', CAST(NULL AS BIGINT)
                FROM products product
                UNION ALL
                SELECT 'PRODUCT', product.product_id, CAST(NULL AS VARCHAR(40)), product.name,
                       CAST(NULL AS VARCHAR(24)), 'SELLABLE', CAST(NULL AS BIGINT)
                FROM products product
            ), movement_balances AS (
                SELECT item_type, item_id, location, scope_id,
                       SUM(CASE WHEN created_at < :fromInclusive THEN quantity_delta ELSE 0 END) AS opening_quantity,
                       SUM(CASE WHEN created_at >= :fromInclusive AND created_at < :toExclusive
                                     AND quantity_delta > 0 THEN quantity_delta ELSE 0 END) AS incoming_quantity,
                       SUM(CASE WHEN created_at >= :fromInclusive AND created_at < :toExclusive
                                     AND quantity_delta < 0 THEN -quantity_delta ELSE 0 END) AS outgoing_quantity,
                       SUM(quantity_delta) AS closing_quantity
                FROM inventory_movements
                WHERE created_at < :toExclusive
                GROUP BY item_type, item_id, location, scope_id
            )
            SELECT item.item_type, item.item_id, item.item_code, item.item_name, item.unit,
                   item.location, item.scope_id,
                   COALESCE(balance.opening_quantity, CAST(0 AS NUMERIC(15,3))) AS opening_quantity,
                   COALESCE(balance.incoming_quantity, CAST(0 AS NUMERIC(15,3))) AS incoming_quantity,
                   COALESCE(balance.outgoing_quantity, CAST(0 AS NUMERIC(15,3))) AS outgoing_quantity,
                   COALESCE(balance.closing_quantity, CAST(0 AS NUMERIC(15,3))) AS closing_quantity
            FROM report_items item
            LEFT JOIN movement_balances balance
              ON balance.item_type = item.item_type AND balance.item_id = item.item_id
             AND balance.location = item.location
             AND (balance.scope_id = item.scope_id OR (balance.scope_id IS NULL AND item.scope_id IS NULL))
            ORDER BY item.item_type, item.location, item.item_id, item.scope_id
            """;

    private static final String MOVEMENT_TOTALS_SQL = """
            SELECT item_type, location, movement_type,
                   SUM(CASE WHEN quantity_delta > 0 THEN quantity_delta ELSE 0 END) AS incoming_quantity,
                   SUM(CASE WHEN quantity_delta < 0 THEN -quantity_delta ELSE 0 END) AS outgoing_quantity,
                   SUM(quantity_delta) AS net_quantity
            FROM inventory_movements
            WHERE created_at >= :fromInclusive AND created_at < :toExclusive
            GROUP BY item_type, location, movement_type
            ORDER BY location, item_type, movement_type
            """;

    private final NamedParameterJdbcTemplate db;

    public WarehouseReportService(NamedParameterJdbcTemplate db) {
        this.db = db;
    }

    @Transactional(readOnly = true)
    public WarehouseReportDto report(String requestedPeriod, Integer requestedYear, Integer month, Integer quarter) {
        PeriodWindow period = periodWindow(requestedPeriod, requestedYear, month, quarter);
        Instant historyAvailableFrom = historyAvailableFrom();
        if (historyAvailableFrom != null && !period.toExclusive().isAfter(historyAvailableFrom)) {
            throw new ApiException(HttpStatus.CONFLICT, "REPORT_HISTORY_UNAVAILABLE",
                    "Sổ tồn kho chỉ có dữ liệu từ " + historyAvailableFrom.atZone(REPORT_ZONE).toLocalDate() + ".");
        }
        boolean historyComplete = historyAvailableFrom != null
                && !period.fromInclusive().isBefore(historyAvailableFrom);
        Instant effectiveFromInclusive = historyAvailableFrom == null || historyComplete
                ? period.fromInclusive() : historyAvailableFrom;
        Map<String, Object> bounds = new LinkedHashMap<>();
        bounds.put("fromInclusive", Timestamp.from(effectiveFromInclusive));
        bounds.put("toExclusive", Timestamp.from(period.toExclusive()));

        List<WarehouseReportDto.BalanceLine> balances = db.queryForList(BALANCES_SQL, bounds).stream()
                .map(row -> new WarehouseReportDto.BalanceLine(string(row.get("item_type")), number(row.get("item_id")),
                        string(row.get("item_code")), string(row.get("item_name")), string(row.get("unit")),
                        string(row.get("location")), nullableNumber(row.get("scope_id")),
                        decimal(row.get("opening_quantity")), decimal(row.get("incoming_quantity")),
                        decimal(row.get("outgoing_quantity")), decimal(row.get("closing_quantity"))))
                .toList();
        List<WarehouseReportDto.MovementTotal> movementTotals = db.queryForList(MOVEMENT_TOTALS_SQL, bounds).stream()
                .map(row -> new WarehouseReportDto.MovementTotal(string(row.get("item_type")),
                        string(row.get("location")), string(row.get("movement_type")),
                        decimal(row.get("incoming_quantity")), decimal(row.get("outgoing_quantity")),
                        decimal(row.get("net_quantity"))))
                .toList();

        return new WarehouseReportDto(period.period(), period.year(), period.month(), period.quarter(),
                period.fromInclusive(), period.toExclusive(), effectiveFromInclusive, historyAvailableFrom,
                historyComplete, balances, movementTotals);
    }

    private Instant historyAvailableFrom() {
        Object value = db.queryForObject("""
                SELECT MIN(created_at) FROM inventory_movements
                WHERE movement_type = 'OPENING'
                  AND reference_type IN ('MIGRATION_026_OPENING', 'SEED_OPENING')
                """, Map.of(), Object.class);
        return instant(value);
    }

    static PeriodWindow periodWindow(String requestedPeriod, Integer requestedYear, Integer month, Integer quarter) {
        String period = requestedPeriod == null ? "" : requestedPeriod.trim().toUpperCase(Locale.ROOT);
        if (!List.of("MONTH", "QUARTER", "YEAR").contains(period)) throw invalidPeriod();
        int year = requestedYear == null ? Instant.now().atZone(REPORT_ZONE).getYear() : requestedYear;
        if (year < 1900 || year > 9999) throw invalidPeriod();

        LocalDate startDate;
        LocalDate endDate;
        Integer normalizedMonth = null;
        Integer normalizedQuarter = null;
        switch (period) {
            case "MONTH" -> {
                if (month == null || month < 1 || month > 12 || quarter != null) throw invalidPeriod();
                normalizedMonth = month;
                YearMonth yearMonth = YearMonth.of(year, month);
                startDate = yearMonth.atDay(1);
                endDate = yearMonth.plusMonths(1).atDay(1);
            }
            case "QUARTER" -> {
                if (quarter == null || quarter < 1 || quarter > 4 || month != null) throw invalidPeriod();
                normalizedQuarter = quarter;
                int startMonth = (quarter - 1) * 3 + 1;
                startDate = LocalDate.of(year, startMonth, 1);
                endDate = startDate.plusMonths(3);
            }
            case "YEAR" -> {
                if (month != null || quarter != null) throw invalidPeriod();
                startDate = LocalDate.of(year, 1, 1);
                endDate = startDate.plusYears(1);
            }
            default -> throw invalidPeriod();
        }
        return new PeriodWindow(period, year, normalizedMonth, normalizedQuarter,
                startDate.atStartOfDay(REPORT_ZONE).toInstant(), endDate.atStartOfDay(REPORT_ZONE).toInstant());
    }

    private static BigDecimal decimal(Object value) {
        BigDecimal result = value instanceof BigDecimal decimal ? decimal
                : value instanceof Number number ? new BigDecimal(number.toString()) : BigDecimal.ZERO;
        return result.setScale(3, RoundingMode.UNNECESSARY);
    }

    private static long number(Object value) {
        return value instanceof Number number ? number.longValue() : 0;
    }

    private static Long nullableNumber(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static String string(Object value) {
        return value == null ? null : value.toString();
    }

    private static Instant instant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value instanceof OffsetDateTime offsetDateTime) return offsetDateTime.toInstant();
        if (value instanceof ZonedDateTime zonedDateTime) return zonedDateTime.toInstant();
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.time.LocalDateTime localDateTime) return localDateTime.atZone(REPORT_ZONE).toInstant();
        return null;
    }

    private static ApiException invalidPeriod() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REPORT_PERIOD",
                "Kỳ báo cáo phải là MONTH, QUARTER hoặc YEAR với tham số ngày tương ứng.");
    }

    private static class PeriodWindow {
        private final String period;
        private final int year;
        private final Integer month;
        private final Integer quarter;
        private final Instant fromInclusive;
        private final Instant toExclusive;

        private PeriodWindow(String period, int year, Integer month, Integer quarter,
                             Instant fromInclusive, Instant toExclusive) {
            this.period = period;
            this.year = year;
            this.month = month;
            this.quarter = quarter;
            this.fromInclusive = fromInclusive;
            this.toExclusive = toExclusive;
        }

        String period() { return period; }
        int year() { return year; }
        Integer month() { return month; }
        Integer quarter() { return quarter; }
        Instant fromInclusive() { return fromInclusive; }
        Instant toExclusive() { return toExclusive; }
    }
}
