package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "support_tickets",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_support_request",
            columnNames = {"created_by", "request_key"}),
    indexes = {
      @Index(name = "idx_support_customer", columnList = "customer_id,updated_at,id"),
      @Index(name = "idx_support_queue", columnList = "status,assignee_id,updated_at,id")
    })
public class SupportTicket {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "customer_id", nullable = false)
  public Long customerId;

  @Column(name = "order_id")
  public Long orderId;

  @Column(name = "assignee_id")
  public Long assigneeId;

  @Column(name = "created_by", nullable = false)
  public Long createdBy;

  @Column(name = "request_key", nullable = false, length = 36)
  public String requestKey;

  @Column(nullable = false, length = 150)
  public String title;

  @Column(nullable = false, length = 4000)
  public String description;

  @Column(nullable = false, length = 30)
  public String status = "NEW";

  // Bounded append-only conversation, serialized explicitly. No additional message table.
  @Column(nullable = false, columnDefinition = "text")
  public String messages = "[]";

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  public Instant updatedAt;

  @Column(name = "resolved_at")
  public Instant resolvedAt;

  @Version
  @Column(nullable = false)
  public long version;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id", insertable = false, updatable = false)
  private User customer;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id", insertable = false, updatable = false)
  private Order order;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "assignee_id", insertable = false, updatable = false)
  private User assignee;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by", insertable = false, updatable = false)
  private User creator;
}
