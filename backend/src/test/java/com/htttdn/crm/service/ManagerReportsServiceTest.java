package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class ManagerReportsServiceTest {
    @Test
    void monthBoundsUseVietnamLocalMidnightAndExclusiveNextMonth() {
        ManagerReportsService.PeriodWindow window = ManagerReportsService.periodWindow(
                2026, 1, Clock.fixed(Instant.parse("2026-01-15T00:00:00Z"), ZoneOffset.UTC));

        assertEquals(Instant.parse("2025-12-31T17:00:00Z"), window.fromInclusive());
        assertEquals(Instant.parse("2026-01-31T17:00:00Z"), window.toExclusive());
    }

    @Test
    void missingYearDefaultsFromTheVietnamCalendarYear() {
        ManagerReportsService.PeriodWindow window = ManagerReportsService.periodWindow(
                null, null, Clock.fixed(Instant.parse("2025-12-31T17:30:00Z"), ZoneOffset.UTC));

        assertEquals(2026, window.year());
        assertEquals(Instant.parse("2025-12-31T17:00:00Z"), window.fromInclusive());
    }

    @Test
    void annualTrendHasTwelveVietnameseMonthLabelsAndZeroValues() {
        List<ManagerReportsService.TrendBucket> buckets = ManagerReportsService.trendBuckets(2026, null);

        assertEquals(IntStream.rangeClosed(1, 12).mapToObj(month -> "Tháng " + month).toList(),
                buckets.stream().map(ManagerReportsService.TrendBucket::label).toList());
        assertTrue(buckets.stream().allMatch(bucket ->
                bucket.income().equals(java.math.BigDecimal.ZERO)
                        && bucket.expense().equals(java.math.BigDecimal.ZERO)));
    }

    @Test
    void monthlyTrendUsesEveryDayIncludingLeapDayAndVietnameseDateLabels() {
        List<ManagerReportsService.TrendBucket> buckets = ManagerReportsService.trendBuckets(2024, 2);

        assertEquals(29, buckets.size());
        assertEquals("01/02", buckets.getFirst().label());
        assertEquals("29/02", buckets.getLast().label());
    }

    @Test
    void invalidYearsAndMonthsAreRejectedAsBadRequests() {
        Clock now = Clock.fixed(Instant.parse("2026-01-15T00:00:00Z"), ZoneOffset.UTC);

        for (Object[] invalid : new Object[][]{
                new Object[]{1899, null, now},
                new Object[]{10000, null, now},
                new Object[]{2026, 0, now},
                new Object[]{2026, 13, now}}) {
            ApiException apiError = assertThrows(ApiException.class,
                    () -> ManagerReportsService.periodWindow((Integer) invalid[0],
                            (Integer) invalid[1], (Clock) invalid[2]));
            assertEquals(400, apiError.status().value());
        }
    }
}
