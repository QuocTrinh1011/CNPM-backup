package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "audit_logs",
    indexes = {
      @Index(name = "idx_audit_created", columnList = "created_at,id"),
      @Index(name = "idx_audit_actor_role", columnList = "actor_role,created_at")
    })
public class AuditLog {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, updatable = false)
  private Long actorId;

  @Column(nullable = false, updatable = false, length = 150)
  private String actorName;

  @Column(nullable = false, updatable = false, length = 20)
  private String actorRole;

  @Column(nullable = false, updatable = false, length = 40)
  private String action;

  @Column(nullable = false, updatable = false, length = 40)
  private String entityType;

  @Column(nullable = false, updatable = false)
  private Long targetId;

  @Column(nullable = false, updatable = false, columnDefinition = "text")
  private String beforeData;

  @Column(nullable = false, updatable = false, columnDefinition = "text")
  private String afterData;

  @Column(nullable = false, updatable = false)
  private Instant createdAt = Instant.now();

  protected AuditLog() {}

  public AuditLog(
      Long actorId,
      String actorName,
      String actorRole,
      String action,
      String entityType,
      Long targetId,
      String beforeData,
      String afterData) {
    this.actorId = actorId;
    this.actorName = actorName;
    this.actorRole = actorRole;
    this.action = action;
    this.entityType = entityType;
    this.targetId = targetId;
    this.beforeData = beforeData;
    this.afterData = afterData;
  }

  public Long getId() {
    return id;
  }

  public Long getActorId() {
    return actorId;
  }

  public String getActorName() {
    return actorName;
  }

  public String getActorRole() {
    return actorRole;
  }

  public String getAction() {
    return action;
  }

  public String getEntityType() {
    return entityType;
  }

  public Long getTargetId() {
    return targetId;
  }

  public String getBeforeData() {
    return beforeData;
  }

  public String getAfterData() {
    return afterData;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
