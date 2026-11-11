package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "feedback",
    uniqueConstraints = @UniqueConstraint(columnNames = {"order_id", "product_id"}))
public class Feedback {
  @ManyToOne
  @JoinColumn(name = "order_id")
  @com.fasterxml.jackson.annotation.JsonIgnore
  private Order order;

  public Order getOrder() {
    return order;
  }

  public void setOrder(Order value) {
    order = value;
  }

  @Column(nullable = false)
  private boolean hidden = false;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  public boolean isHidden() {
    return hidden;
  }

  public void setHidden(boolean value) {
    hidden = value;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(Instant value) {
    deletedAt = value;
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "feedback_id")
  private Long id;

  @ManyToOne(optional = false)
  @JoinColumn(name = "customer_id")
  private User customer;

  @ManyToOne(optional = false)
  @JoinColumn(name = "product_id")
  private Product product;

  @Column(nullable = false)
  private int rating;

  @Column(name = "content", length = 4000)
  private String comment;

  private String status = "NEW";

  @Column(name = "admin_response", length = 4000)
  private String adminResponse;

  @Column(name = "created_at")
  private Instant createdAt = Instant.now();

  @Column(name = "processed_at")
  private Instant processedAt;

  public Feedback() {}

  public Long getId() {
    return id;
  }

  public User getCustomer() {
    return customer;
  }

  public void setCustomer(User v) {
    customer = v;
  }

  public Product getProduct() {
    return product;
  }

  public void setProduct(Product v) {
    product = v;
  }

  public int getRating() {
    return rating;
  }

  public void setRating(int v) {
    rating = v;
  }

  public String getComment() {
    return comment;
  }

  public void setComment(String v) {
    comment = v;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String v) {
    status = v;
  }

  public String getAdminResponse() {
    return adminResponse;
  }

  public void setAdminResponse(String v) {
    adminResponse = v;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant v) {
    createdAt = v;
  }

  public Instant getProcessedAt() {
    return processedAt;
  }

  public void setProcessedAt(Instant v) {
    processedAt = v;
  }
}
