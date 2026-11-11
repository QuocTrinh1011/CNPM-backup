package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PromotionInvoiceRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromotionInvoiceRuleRepository extends JpaRepository<PromotionInvoiceRule, Long> {
    List<PromotionInvoiceRule> findByCampaignIdOrderByIdAsc(Long campaignId);
    long countByCampaignId(Long campaignId);
    void deleteByCampaignId(Long campaignId);
}
