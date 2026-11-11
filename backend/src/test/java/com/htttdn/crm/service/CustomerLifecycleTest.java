package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.Test;

class CustomerLifecycleTest {
  LocalDate today = LocalDate.of(2026, 10, 6);

  @Test
  void countAndValueBoundariesWithLoyaltyPriority() {
    for (int n : new int[] {0, 1, 2, 4, 5})
      assertEquals(
          n == 0 ? "NO_PURCHASE" : n == 1 ? "FIRST_PURCHASE" : n == 5 ? "LOYAL" : "RETURNING",
          CustomerLifecycle.calculate(n, BigDecimal.ONE, null, today).stage());
    for (String value : new String[] {"4999999", "5000000", "5000001"})
      assertEquals(
          value.equals("4999999") ? "FIRST_PURCHASE" : "LOYAL",
          CustomerLifecycle.calculate(1, new BigDecimal(value), null, today).stage());
    assertEquals(
        "LOYAL", CustomerLifecycle.calculate(5, new BigDecimal("5000000"), null, today).stage());
    assertFalse(CustomerLifecycle.calculate(0, BigDecimal.ZERO, null, today).dormant());
    assertNull(
        CustomerLifecycle.calculate(0, BigDecimal.ZERO, null, today).daysSinceLastPurchase());
  }

  @Test
  void vietnamCalendarRatherThanElapsedHours() {
    for (int days : new int[] {29, 30, 31}) {
      Instant last =
          today.minusDays(days).atTime(23, 59).atZone(CustomerLifecycle.ZONE).toInstant();
      var s = CustomerLifecycle.calculate(1, BigDecimal.ONE, last, today);
      assertEquals((long) days, s.daysSinceLastPurchase());
      assertEquals(days >= 30, s.dormant());
    }
    assertTrue(
        CustomerLifecycle.calculate(1, BigDecimal.ONE, Instant.parse("2026-09-06T16:59:59Z"), today)
            .dormant());
    assertFalse(
        CustomerLifecycle.calculate(1, BigDecimal.ONE, Instant.parse("2026-09-06T17:00:00Z"), today)
            .dormant());
  }
}
