package com.htttdn.crm.entity;

import jakarta.persistence.*;

@Entity
@Table(
    name = "cart_items",
    uniqueConstraints =
        @UniqueConstraint(columnNames = {"customer_id", "product_id", "size", "color"}))
public class CartItem {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id")
  private User customer;

  @ManyToOne(optional = false, fetch = FetchType.EAGER)
  @JoinColumn(name = "product_id")
  private Product product;

  @Column(nullable = false)
  private int quantity;

  private String size;
  private String color;

  public CartItem() {}

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

  public int getQuantity() {
    return quantity;
  }

  public void setQuantity(int v) {
    quantity = v;
  }

  public String getSize() {
    return size;
  }

  public void setSize(String v) {
    size = v;
  }

  public String getColor() {
    return color;
  }

  public void setColor(String v) {
    color = v;
  }
}
