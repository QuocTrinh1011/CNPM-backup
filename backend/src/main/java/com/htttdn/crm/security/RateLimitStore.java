package com.htttdn.crm.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * In-memory limiter state: per-IP token bucket for all API traffic plus a fixed-window counter for
 * failed auth attempts. Single node only; state resets on restart.
 */
final class RateLimitStore {
  private static final Duration IDLE_TIMEOUT = Duration.ofMinutes(60);

  private final Clock clock;
  private final int capacity;
  private final int perMinute;
  private final int maxAttempts;
  private final Duration authWindow;
  private final Map<String, Bucket> global = new LinkedHashMap<>();
  private final Map<String, Failures> auth = new LinkedHashMap<>();

  RateLimitStore(Clock clock, int capacity, int perMinute, int maxAttempts, int windowMinutes) {
    this.clock = clock;
    this.capacity = capacity;
    this.perMinute = perMinute;
    this.maxAttempts = maxAttempts;
    this.authWindow = Duration.ofMinutes(windowMinutes);
  }

  synchronized boolean tryConsumeGlobal(String ipHash) {
    Instant now = clock.instant();
    evictIdle(global, now, IDLE_TIMEOUT, b -> b.lastAccess);
    Bucket bucket = global.computeIfAbsent(ipHash, k -> new Bucket(perMinute, now));
    double ratePerSecond = perMinute / 60.0;
    long elapsedMillis = Duration.between(bucket.lastRefill, now).toMillis();
    bucket.tokens = Math.min(perMinute, bucket.tokens + elapsedMillis / 1000.0 * ratePerSecond);
    bucket.lastRefill = now;
    bucket.lastAccess = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  synchronized long globalRetryAfterSeconds(String ipHash) {
    Bucket bucket = global.get(ipHash);
    if (bucket == null || bucket.tokens >= 1) return 1;
    double missing = 1 - bucket.tokens;
    return Math.max(1, (long) Math.ceil(missing / (perMinute / 60.0)));
  }

  synchronized boolean isAuthBlocked(String keyHash) {
    Instant now = clock.instant();
    evictIdle(auth, now, authWindow.plus(IDLE_TIMEOUT), f -> f.lastAccess);
    Failures failures = auth.get(keyHash);
    if (failures == null) return false;
    failures.lastAccess = now;
    return failures.count >= maxAttempts && !now.isAfter(failures.windowStart.plus(authWindow));
  }

  synchronized long authRetryAfterSeconds(String keyHash) {
    Failures failures = auth.get(keyHash);
    if (failures == null) return 60;
    long remaining =
        Duration.between(clock.instant(), failures.windowStart.plus(authWindow)).getSeconds();
    return Math.max(1, remaining);
  }

  synchronized void recordAuthFailure(String keyHash) {
    Instant now = clock.instant();
    evictIdle(auth, now, authWindow.plus(IDLE_TIMEOUT), f -> f.lastAccess);
    if (auth.size() >= capacity && !auth.containsKey(keyHash)) {
      var eldest = auth.entrySet().iterator();
      if (eldest.hasNext()) {
        eldest.next();
        eldest.remove();
      }
    }
    Failures failures = auth.computeIfAbsent(keyHash, k -> new Failures());
    if (failures.windowStart == null || now.isAfter(failures.windowStart.plus(authWindow))) {
      failures.count = 0;
      failures.windowStart = now;
    }
    failures.count++;
    failures.lastAccess = now;
  }

  private static <T> void evictIdle(
      Map<String, T> map, Instant now, Duration timeout, Function<T, Instant> lastAccessOf) {
    var entries = map.entrySet().iterator();
    while (entries.hasNext()) {
      if (!lastAccessOf.apply(entries.next().getValue()).isBefore(now.minus(timeout))) break;
      entries.remove();
    }
  }

  private static final class Bucket {
    double tokens;
    Instant lastRefill;
    Instant lastAccess;

    Bucket(double tokens, Instant now) {
      this.tokens = tokens;
      this.lastRefill = now;
      this.lastAccess = now;
    }
  }

  private static final class Failures {
    int count;
    Instant windowStart;
    Instant lastAccess;
  }
}
