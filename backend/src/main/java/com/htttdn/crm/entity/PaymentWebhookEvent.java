package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "payment_webhook_events",
    uniqueConstraints = @UniqueConstraint(columnNames = "event_key"))
public class PaymentWebhookEvent {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "event_key", nullable = false, length = 255)
  private String eventKey;

  private Long orderCode;
  private Instant receivedAt = Instant.now();

  public PaymentWebhookEvent() {}

  public Long getId() {
    return id;
  }

  public String getEventKey() {
    return eventKey;
  }

  public void setEventKey(String v) {
    eventKey = v;
  }

  public Long getOrderCode() {
    return orderCode;
  }

  public void setOrderCode(Long v) {
    orderCode = v;
  }

  public Instant getReceivedAt() {
    return receivedAt;
  }

  public void setReceivedAt(Instant v) {
    receivedAt = v;
  }
}
