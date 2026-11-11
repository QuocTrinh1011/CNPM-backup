package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "orders")
public class Order {
  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "paid_at")
  public Instant paidAt;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "refund_status", nullable = false, length = 10)
  public String refundStatus = "NONE";

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "refunded_amount", nullable = false, precision = 15, scale = 2)
  public BigDecimal refundedAmount = BigDecimal.ZERO;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "refund_pending_amount", nullable = false, precision = 15, scale = 2)
  public BigDecimal refundPendingAmount = BigDecimal.ZERO;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "cod_collected_amount", precision = 15, scale = 2)
  public BigDecimal codCollectedAmount;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "cod_collected_at")
  public Instant codCollectedAt;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "cod_collected_by")
  public Long codCollectedBy;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "cod_collection_note", length = 1000)
  public String codCollectionNote;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "payment_review_required", nullable = false)
  public boolean paymentReviewRequired;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "payment_review_reason", length = 120)
  public String paymentReviewReason;

  @com.fasterxml.jackson.annotation.JsonIgnore
  @Column(name = "payment_review_at")
  public Instant paymentReviewAt;

  @OneToMany(mappedBy = "order", fetch = FetchType.EAGER)
  @OrderBy("id ASC")
  private List<OrderReturnEvent> returnHistory = new ArrayList<>();

  public List<OrderReturnEvent> getReturnHistory() {
    return returnHistory;
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "order_id")
  private Long id;

  @Column(name = "order_code", nullable = false, unique = true)
  private Long orderCode;

  @ManyToOne(optional = false)
  @JoinColumn(name = "customer_id")
  private User customer;

  @Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
  private BigDecimal totalAmount = BigDecimal.ZERO;

  @Column(name = "discount_amount", nullable = false, precision = 15, scale = 2)
  private BigDecimal discountAmount = BigDecimal.ZERO;

  @Column(name = "voucher_code", length = 40)
  private String voucherCode;

  private String status = "PENDING_PAYMENT";

  @Column(name = "payment_status")
  private String paymentStatus = "PENDING";

  @Column(name = "payment_method")
  private String paymentMethod;

  @Column(name = "delivery_address", length = 1000)
  private String deliveryAddress;

  @Column(name = "tracking_code", length = 120)
  private String trackingCode;

  @Column(name = "cancel_reason", length = 1000)
  private String cancelReason;

  @Column(name = "return_reason", length = 1000)
  private String returnReason;

  @Column(name = "return_status", length = 30)
  private String returnStatus = "NONE";

  @Column(name = "return_requested_at")
  private Instant returnRequestedAt;

  @Column(name = "created_at")
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at")
  private Instant updatedAt = Instant.now();

  @JsonManagedReference
  @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
  private List<OrderItem> items = new ArrayList<>();

  @Column(name = "stock_released")
  private boolean stockReleased = false;

  @Column(name = "expires_at")
  private Instant expiresAt;

  @Column(name = "salesperson_id")
  private Long salespersonId;

  public Order() {}

  public Long getId() {
    return id;
  }

  public Long getOrderCode() {
    return orderCode;
  }

  public void setOrderCode(Long v) {
    orderCode = v;
  }

  public User getCustomer() {
    return customer;
  }

  public void setCustomer(User v) {
    customer = v;
  }

  public BigDecimal getTotalAmount() {
    return totalAmount;
  }

  public void setTotalAmount(BigDecimal v) {
    totalAmount = v;
  }

  public BigDecimal getDiscountAmount() {
    return discountAmount;
  }

  public void setDiscountAmount(BigDecimal v) {
    discountAmount = v;
  }

  public String getVoucherCode() {
    return voucherCode;
  }

  public void setVoucherCode(String v) {
    voucherCode = v;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String v) {
    status = v;
  }

  public String getPaymentStatus() {
    return paymentStatus;
  }

  public void setPaymentStatus(String v) {
    paymentStatus = v;
  }

  public String getPaymentMethod() {
    return paymentMethod;
  }

  public void setPaymentMethod(String v) {
    paymentMethod = v;
  }

  public String getDeliveryAddress() {
    return deliveryAddress;
  }

  public void setDeliveryAddress(String v) {
    deliveryAddress = v;
  }

  public String getTrackingCode() {
    return trackingCode;
  }

  public void setTrackingCode(String v) {
    trackingCode = v;
  }

  public String getCancelReason() {
    return cancelReason;
  }

  public void setCancelReason(String v) {
    cancelReason = v;
  }

  public String getReturnReason() {
    return returnReason;
  }

  public void setReturnReason(String v) {
    returnReason = v;
  }

  public String getReturnStatus() {
    return returnStatus;
  }

  public void setReturnStatus(String v) {
    returnStatus = v;
  }

  public Instant getReturnRequestedAt() {
    return returnRequestedAt;
  }

  public void setReturnRequestedAt(Instant v) {
    returnRequestedAt = v;
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

  public List<OrderItem> getItems() {
    return items;
  }

  public void setItems(List<OrderItem> v) {
    items = v;
  }

  public boolean isStockReleased() {
    return stockReleased;
  }

  public void setStockReleased(boolean v) {
    stockReleased = v;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant v) {
    expiresAt = v;
  }

  public Long getSalespersonId() {
    return salespersonId;
  }

  public void setSalespersonId(Long v) {
    salespersonId = v;
  }
}
