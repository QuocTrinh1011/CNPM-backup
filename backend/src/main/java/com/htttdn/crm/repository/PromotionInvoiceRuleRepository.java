package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PromotionInvoiceRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PromotionInvoiceRuleRepository extends JpaRepository<PromotionInvoiceRule, Long> {
    List<PromotionInvoiceRule> findByCampaignIdOrderByIdAsc(Long campaignId);
    @Query("select r.campaignId as campaignId, count(r.id) as ruleCount from PromotionInvoiceRule r where r.campaignId in :campaignIds group by r.campaignId")
    List<CampaignRuleCount> countGroupedByCampaignIds(@Param("campaignIds") Collection<Long> campaignIds);
    long countByCampaignId(Long campaignId);
    void deleteByCampaignId(Long campaignId);
}
