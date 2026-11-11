package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payments", uniqueConstraints = @UniqueConstraint(columnNames = "order_id"))
public class Payment {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @OneToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id")
  private Order order;

  @Column(nullable = false, precision = 15, scale = 2)
  private BigDecimal amount;

  private String paymentLinkId;

  @Column(length = 2000)
  private String checkoutUrl;

  @Column(name = "qr_code", columnDefinition = "text")
  private String qrCode;

  @Column(nullable = false)
  private String status = "PENDING";

  private Instant expiresAt;
  private Instant createdAt = Instant.now();
  private Instant updatedAt = Instant.now();

  public Payment() {}

  public Long getId() {
    return id;
  }

  public Order getOrder() {
    return order;
  }

  public void setOrder(Order v) {
    order = v;
  }

  public BigDecimal getAmount() {
    return amount;
  }

  public void setAmount(BigDecimal v) {
    amount = v;
  }

  public String getPaymentLinkId() {
    return paymentLinkId;
  }

  public void setPaymentLinkId(String v) {
    paymentLinkId = v;
  }

  public String getCheckoutUrl() {
    return checkoutUrl;
  }

  public void setCheckoutUrl(String v) {
    checkoutUrl = v;
  }

  public String getQrCode() {
    return qrCode;
  }

  public void setQrCode(String v) {
    qrCode = v;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String v) {
    status = v;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant v) {
    expiresAt = v;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant v) {
    createdAt = v;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant v) {
    updatedAt = v;
  }
}
