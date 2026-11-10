package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "promotion_voucher_rules",
    uniqueConstraints = @UniqueConstraint(name = "uq_promotion_voucher_rule", columnNames = {"campaign_id", "voucher_id"}))
public class PromotionVoucherRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;

    @Column(name = "discount_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPercent;

    public PromotionVoucherRule() {}

    public Long getId() { return id; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long campaignId) { this.campaignId = campaignId; }
    public Long getVoucherId() { return voucherId; }
    public void setVoucherId(Long voucherId) { this.voucherId = voucherId; }
    public BigDecimal getDiscountPercent() { return discountPercent; }
    public void setDiscountPercent(BigDecimal discountPercent) { this.discountPercent = discountPercent; }
}
