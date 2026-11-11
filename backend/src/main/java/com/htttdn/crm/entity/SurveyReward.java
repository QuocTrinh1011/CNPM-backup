package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Embeddable
public class SurveyReward {
  @Column(name = "reward_enabled")
  private boolean enabled;

  @Column(name = "reward_type")
  private String discountType;

  @Column(name = "reward_value", precision = 12, scale = 2)
  private BigDecimal discountValue;

  @Column(name = "reward_minimum", precision = 12, scale = 2)
  private BigDecimal minOrderAmount;

  @Column(name = "reward_maximum", precision = 12, scale = 2)
  private BigDecimal maxDiscountAmount;

  @Column(name = "reward_days")
  private Integer validDays;

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean v) {
    enabled = v;
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

  public BigDecimal getMaxDiscountAmount() {
    return maxDiscountAmount;
  }

  public void setMaxDiscountAmount(BigDecimal v) {
    maxDiscountAmount = v;
  }

  public Integer getValidDays() {
    return validDays;
  }

  public void setValidDays(Integer v) {
    validDays = v;
  }
}
