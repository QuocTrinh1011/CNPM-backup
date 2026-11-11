package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
    name = "order_refunds",
    uniqueConstraints = @UniqueConstraint(columnNames = {"order_id", "request_key"}))
public class OrderRefund {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "order_id", nullable = false)
  public Order order;

  @Column(name = "reason_type", nullable = false, length = 10)
  public String reasonType;

  @Column(nullable = false, precision = 15, scale = 2)
  public BigDecimal amount;

  @Column(nullable = false, length = 10)
  public String status = "PENDING";

  @Column(name = "request_key", nullable = false, length = 100)
  public String requestKey;

  @Column(length = 1000)
  public String note;

  @Column(name = "processing_note", length = 1000)
  public String processingNote;

  @Column(name = "bank_reference", length = 120)
  public String bankReference;

  @Column(name = "requested_by")
  public Long requestedBy;

  @Column(name = "processed_by")
  public Long processedBy;

  @Column(name = "requested_at", nullable = false)
  public Instant requestedAt = Instant.now();

  @Column(name = "processed_at")
  public Instant processedAt;
}
