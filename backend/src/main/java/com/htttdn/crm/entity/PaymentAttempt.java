package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "payment_attempts")
public class PaymentAttempt {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id")
  private Order order;

  @Column(name = "provider_order_code", nullable = false, unique = true)
  private Long providerOrderCode;

  @Column(name = "payment_link_id", length = 255)
  private String paymentLinkId;

  @Column(name = "checkout_url", length = 2000)
  private String checkoutUrl;

  @Column(name = "qr_code", columnDefinition = "text")
  private String qrCode;

  @Column(nullable = false, length = 30)
  private String status = "PENDING";

  @Column(name = "expires_at")
  private Instant expiresAt;

  @Column(name = "created_at")
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at")
  private Instant updatedAt = Instant.now();

  public Long getId() {
    return id;
  }

  public Order getOrder() {
    return order;
  }

  public void setOrder(Order value) {
    order = value;
  }

  public Long getProviderOrderCode() {
    return providerOrderCode;
  }

  public void setProviderOrderCode(Long value) {
    providerOrderCode = value;
  }

  public String getPaymentLinkId() {
    return paymentLinkId;
  }

  public void setPaymentLinkId(String value) {
    paymentLinkId = value;
  }

  public String getCheckoutUrl() {
    return checkoutUrl;
  }

  public void setCheckoutUrl(String value) {
    checkoutUrl = value;
  }

  public String getQrCode() {
    return qrCode;
  }

  public void setQrCode(String value) {
    qrCode = value;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String value) {
    status = value;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant value) {
    expiresAt = value;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant value) {
    createdAt = value;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant value) {
    updatedAt = value;
  }
}
