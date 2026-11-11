package com.htttdn.crm.service;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;

/** Shared query-time rules; purchase date is the order creation date, not completion date. */
public final class CustomerLifecycle {
  private CustomerLifecycle() {}

  public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  public static final int LOYAL_ORDERS = 5, DORMANT_DAYS = 30;
  public static final BigDecimal LOYAL_VALUE = new BigDecimal("5000000");

  public record Segment(String stage, boolean dormant, Long daysSinceLastPurchase) {}

  public static Segment calculate(long count, BigDecimal value, Instant last, LocalDate today) {
    String stage =
        count == 0
            ? "NO_PURCHASE"
            : count >= LOYAL_ORDERS || value.compareTo(LOYAL_VALUE) >= 0
                ? "LOYAL"
                : count == 1 ? "FIRST_PURCHASE" : "RETURNING";
    Long days =
        count == 0 || last == null
            ? null
            : Math.max(0, ChronoUnit.DAYS.between(last.atZone(ZONE).toLocalDate(), today));
    return new Segment(stage, days != null && days >= DORMANT_DAYS, days);
  }

  public static String stageSql() {
    return "case when completed_orders=0 then 'NO_PURCHASE' when completed_orders >= "
        + LOYAL_ORDERS
        + " or completed_value >= "
        + LOYAL_VALUE
        + " then 'LOYAL' when completed_orders=1 then 'FIRST_PURCHASE' else 'RETURNING' end";
  }
}
