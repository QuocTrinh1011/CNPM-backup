package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
    name = "store_vouchers",
    uniqueConstraints = @UniqueConstraint(columnNames = {"reward_survey_id", "owner_customer_id"}))
public class StoreVoucher {
  @Column(name = "per_customer_limit")
  private Integer perCustomerLimit;

  public Integer getPerCustomerLimit() {
    return perCustomerLimit;
  }

  public void setPerCustomerLimit(Integer v) {
    perCustomerLimit = v;
  }

  private Long ownerCustomerId;
  private Long rewardSurveyId;

  public Long getOwnerCustomerId() {
    return ownerCustomerId;
  }

  public void setOwnerCustomerId(Long v) {
    ownerCustomerId = v;
  }

  public Long getRewardSurveyId() {
    return rewardSurveyId;
  }

  public void setRewardSurveyId(Long v) {
    rewardSurveyId = v;
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true, length = 40)
  private String code;

  @Column(name = "discount_type", nullable = false, length = 20)
  private String discountType = "PERCENTAGE";

  @Column(name = "discount_value", nullable = false, precision = 12, scale = 2)
  private BigDecimal discountValue;

  @Column(name = "min_order_amount", nullable = false, precision = 12, scale = 2)
  private BigDecimal minOrderAmount = BigDecimal.ZERO;

  @Column(name = "usage_limit")
  private Integer usageLimit;

  @Column(name = "used_count", nullable = false)
  private int usedCount;

  @Column(nullable = false)
  private boolean active = true;

  private Instant startsAt;
  private Instant expiresAt;

  public StoreVoucher() {}

  @Column(length = 1000)
  private String description;

  @Column(name = "max_discount_amount", precision = 12, scale = 2)
  private BigDecimal maxDiscountAmount;

  public String getDescription() {
    return description;
  }

  public void setDescription(String v) {
    description = v;
  }

  public BigDecimal getMaxDiscountAmount() {
    return maxDiscountAmount;
  }

  public void setMaxDiscountAmount(BigDecimal v) {
    maxDiscountAmount = v;
  }

  public Long getId() {
    return id;
  }

  public String getCode() {
    return code;
  }

  public void setCode(String v) {
    code = v;
  }

  public String getDiscountType() {
    return discountType;
  }

  public void setDiscountType(String v) {
    discountType = v;
  }

  public BigDecimal getDiscountValue() {
    return discountValue;
  }

  public void setDiscountValue(BigDecimal v) {
    discountValue = v;
  }

  public BigDecimal getMinOrderAmount() {
    return minOrderAmount;
  }

  public void setMinOrderAmount(BigDecimal v) {
    minOrderAmount = v;
  }

  public Integer getUsageLimit() {
    return usageLimit;
  }

  public void setUsageLimit(Integer v) {
    usageLimit = v;
  }

  public int getUsedCount() {
    return usedCount;
  }

  public void setUsedCount(int v) {
    usedCount = v;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean v) {
    active = v;
  }

  public Instant getStartsAt() {
    return startsAt;
  }

  public void setStartsAt(Instant v) {
    startsAt = v;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant v) {
    expiresAt = v;
  }
}
