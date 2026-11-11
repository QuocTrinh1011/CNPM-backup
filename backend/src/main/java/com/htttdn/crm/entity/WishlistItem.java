package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "wishlists",
    uniqueConstraints = @UniqueConstraint(columnNames = {"customer_id", "product_id"}))
public class WishlistItem {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id")
  private User customer;

  @ManyToOne(optional = false, fetch = FetchType.EAGER)
  @JoinColumn(name = "product_id")
  private Product product;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public WishlistItem() {}

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

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant v) {
    createdAt = v;
  }
}
