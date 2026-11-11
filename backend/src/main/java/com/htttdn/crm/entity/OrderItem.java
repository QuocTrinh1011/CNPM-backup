package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "order_items")
public class OrderItem {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "order_item_id")
  private Long id;

  @JsonBackReference
  @ManyToOne
  @JoinColumn(name = "order_id", nullable = false)
  private Order order;

  @ManyToOne(optional = false)
  @JoinColumn(name = "product_id")
  private Product product;

  private int quantity;
  private String size;
  private String color;

  @Column(name = "unit_price", nullable = false, precision = 15, scale = 2)
  private BigDecimal unitPrice;

  public OrderItem() {}

  public Long getId() {
    return id;
  }

  public Order getOrder() {
    return order;
  }

  public void setOrder(Order v) {
    order = v;
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

  public BigDecimal getUnitPrice() {
    return unitPrice;
  }

  public void setUnitPrice(BigDecimal v) {
    unitPrice = v;
  }
}
