package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "customer_care_tasks",
    indexes = {
      @Index(name = "idx_care_tasks_customer", columnList = "customer_id,due_at,id"),
      @Index(name = "idx_care_tasks_assignee", columnList = "assignee_id,status,due_at"),
      @Index(name = "idx_care_tasks_due", columnList = "status,due_at")
    })
public class CustomerCareTask {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "customer_id", nullable = false)
  public Long customerId;

  @Column(name = "assignee_id", nullable = false)
  public Long assigneeId;

  @Column(name = "source_type", length = 30, updatable = false)
  public String sourceType;

  @Column(name = "source_id", updatable = false)
  public Long sourceId;

  @Column(nullable = false, length = 255)
  public String title;

  @Column(nullable = false, length = 4000)
  public String description;

  @Column(nullable = false, length = 30)
  public String status;

  @Column(name = "due_at", nullable = false)
  public Instant dueAt;

  @Column(name = "created_by", nullable = false)
  public Long createdBy;

  @Column(name = "updated_by", nullable = false)
  public Long updatedBy;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  public Instant updatedAt;

  @Column(name = "completed_at")
  public Instant completedAt;

  @Column(name = "outcome", length = 30)
  public String outcome;

  @Column(name = "result_note", length = 4000)
  public String resultNote;

  @Column(name = "parent_task_id", updatable = false)
  public Long parentTaskId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "parent_task_id", insertable = false, updatable = false)
  private CustomerCareTask parentTask;

  @Version
  @Column(nullable = false)
  public long version;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id", insertable = false, updatable = false)
  private User customer;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "assignee_id", insertable = false, updatable = false)
  private User assignee;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by", insertable = false, updatable = false)
  private User creator;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "updated_by", insertable = false, updatable = false)
  private User editor;
}
