package com.htttdn.crm.service;

import com.htttdn.crm.repository.OrderRepository;
import java.time.*;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AbandonedOrderScheduler {
  private static final Logger log = LoggerFactory.getLogger(AbandonedOrderScheduler.class);
  private final OrderRepository orders;
  private final AbandonedOrderWorker worker;
  private final boolean enabled;
  private final Duration grace;

  public AbandonedOrderScheduler(
      OrderRepository orders,
      AbandonedOrderWorker worker,
      @Value("${PAYOS_AUTO_CANCEL_ENABLED:false}") boolean enabled,
      @Value("${PAYOS_AUTO_CANCEL_GRACE_HOURS:24}") long hours) {
    if (hours < 1 || hours > 720)
      throw new IllegalArgumentException("PAYOS_AUTO_CANCEL_GRACE_HOURS phải từ 1 đến 720.");
    this.orders = orders;
    this.worker = worker;
    this.enabled = enabled;
    this.grace = Duration.ofHours(hours);
  }

  @Scheduled(fixedDelayString = "${app.payos.auto-cancel-ms:300000}")
  public void run() {
    if (!enabled) return;
    Instant now = Instant.now();
    long after = 0;
    while (true) {
      var ids = orders.abandonedIds(after, now.minus(grace), PageRequest.of(0, 100));
      if (ids.isEmpty()) return;
      for (Long id : ids) {
        after = id;
        try {
          String result = worker.cancel(id, now, grace);
          if (!"SKIPPED".equals(result)) log.info("PayOS auto-cancel order {}: {}", id, result);
        } catch (Exception ex) {
          log.warn("PayOS auto-cancel failed for order {} ({})", id, ex.getClass().getSimpleName());
        }
      }
    }
  }
}
