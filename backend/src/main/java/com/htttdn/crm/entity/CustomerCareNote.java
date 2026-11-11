package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "customer_care_notes",
    indexes = @Index(name = "idx_care_notes_customer", columnList = "customer_id,created_at,id"))
public class CustomerCareNote {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "customer_id", nullable = false)
  public Long customerId;

  @Column(name = "author_id", nullable = false)
  public Long authorId;

  @Column(name = "author_name", nullable = false, length = 255)
  public String authorName;

  @Column(nullable = false, length = 4000)
  public String content;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id", insertable = false, updatable = false)
  private User customer;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "author_id", insertable = false, updatable = false)
  private User author;
}
