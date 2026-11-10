package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "promotion_invoice_rules",
    uniqueConstraints = @UniqueConstraint(name = "uq_promotion_invoice_rule", columnNames = {"campaign_id", "minimum_invoice_amount"}))
public class PromotionInvoiceRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "minimum_invoice_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal minimumInvoiceAmount;

    @Column(name = "discount_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPercent;

    public PromotionInvoiceRule() {}

    public Long getId() { return id; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long campaignId) { this.campaignId = campaignId; }
    public BigDecimal getMinimumInvoiceAmount() { return minimumInvoiceAmount; }
    public void setMinimumInvoiceAmount(BigDecimal minimumInvoiceAmount) { this.minimumInvoiceAmount = minimumInvoiceAmount; }
    public BigDecimal getDiscountPercent() { return discountPercent; }
    public void setDiscountPercent(BigDecimal discountPercent) { this.discountPercent = discountPercent; }
}
