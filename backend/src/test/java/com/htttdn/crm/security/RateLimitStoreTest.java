package com.htttdn.crm.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Clock;
import java.time.Instant;
import java.util.Collections;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;

class RateLimitStoreTest {
  private static final Instant START = Instant.parse("2026-10-26T00:00:00Z");

  private Clock clockAt(Instant instant) {
    var clock = mock(Clock.class);
    when(clock.instant()).thenReturn(instant);
    return clock;
  }

  @Test
  void globalBucketRefillsAfterOneMinute() {
    var clock = clockAt(START);
    var store = new RateLimitStore(clock, 10, 3, 5, 15);
    assertTrue(store.tryConsumeGlobal("ip1"));
    assertTrue(store.tryConsumeGlobal("ip1"));
    assertTrue(store.tryConsumeGlobal("ip1"));
    assertFalse(store.tryConsumeGlobal("ip1"));
    long retryAfter = store.globalRetryAfterSeconds("ip1");
    assertTrue(retryAfter >= 15 && retryAfter <= 25);
    when(clock.instant()).thenReturn(START.plusSeconds(60));
    assertTrue(store.tryConsumeGlobal("ip1"));
  }

  @Test
  void globalBucketsAreIndependentPerIp() {
    var clock = clockAt(START);
    var store = new RateLimitStore(clock, 10, 2, 5, 15);
    assertTrue(store.tryConsumeGlobal("ip1"));
    assertTrue(store.tryConsumeGlobal("ip1"));
    assertFalse(store.tryConsumeGlobal("ip1"));
    assertTrue(store.tryConsumeGlobal("ip2"));
  }

  @Test
  void authBlocksAfterMaxAttemptsAndResetsAfterWindow() {
    var clock = clockAt(START);
    var store = new RateLimitStore(clock, 10, 120, 2, 15);
    store.recordAuthFailure("key1");
    assertFalse(store.isAuthBlocked("key1"));
    store.recordAuthFailure("key1");
    assertTrue(store.isAuthBlocked("key1"));
    assertTrue(store.authRetryAfterSeconds("key1") <= 900);
    when(clock.instant()).thenReturn(START.plusSeconds(15 * 60 + 1));
    assertFalse(store.isAuthBlocked("key1"));
    store.recordAuthFailure("key1");
    assertFalse(store.isAuthBlocked("key1"));
  }

  @Test
  void authKeysAreIndependent() {
    var clock = clockAt(START);
    var store = new RateLimitStore(clock, 10, 120, 2, 15);
    store.recordAuthFailure("ip:a");
    store.recordAuthFailure("ip:a");
    assertTrue(store.isAuthBlocked("ip:a"));
    assertFalse(store.isAuthBlocked("ip:b"));
  }

  @Test
  void authCapacityEvictsEldestKey() {
    var clock = clockAt(START);
    var store = new RateLimitStore(clock, 2, 120, 1, 15);
    store.recordAuthFailure("key1");
    store.recordAuthFailure("key2");
    store.recordAuthFailure("key3");
    assertFalse(store.isAuthBlocked("key1"));
    assertTrue(store.isAuthBlocked("key2"));
  }

  @Test
  void concurrentFailuresForOneKeyAreAllRecorded() throws Exception {
    var store = new RateLimitStore(Clock.systemUTC(), 10, 120, 5, 15);
    try (var executor = Executors.newFixedThreadPool(8)) {
      Callable<Void> failure =
          () -> {
            store.recordAuthFailure("key1");
            return null;
          };
      var results = executor.invokeAll(Collections.nCopies(32, failure));
      for (var result : results) result.get();
    }
    assertTrue(store.isAuthBlocked("key1"));
  }
}
