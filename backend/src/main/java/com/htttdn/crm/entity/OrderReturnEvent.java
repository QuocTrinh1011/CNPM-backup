package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "order_return_events",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_return_event_order_status",
            columnNames = {"order_id", "status"}))
public class OrderReturnEvent {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @JsonIgnore
  @ManyToOne(optional = false)
  @JoinColumn(name = "order_id")
  private Order order;

  @JsonIgnore
  @Column(name = "manager_id")
  private Long managerId;

  @Column(name = "manager_name", nullable = false, length = 255)
  private String managerName;

  @Column(nullable = false, length = 30)
  private String status;

  @Column(nullable = false, length = 1000)
  private String note;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  public OrderReturnEvent() {}

  public OrderReturnEvent(Order order, User manager, String status, String note) {
    this.order = order;
    this.managerId = manager.getId();
    this.managerName = manager.getFullName();
    this.status = status;
    this.note = note;
    this.createdAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public String getManagerName() {
    return managerName;
  }

  public String getStatus() {
    return status;
  }

  public String getNote() {
    return note;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
