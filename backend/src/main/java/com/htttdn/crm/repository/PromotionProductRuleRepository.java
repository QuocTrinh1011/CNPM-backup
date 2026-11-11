package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PromotionProductRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PromotionProductRuleRepository extends JpaRepository<PromotionProductRule, Long> {
    List<PromotionProductRule> findByCampaignIdOrderByIdAsc(Long campaignId);
    @Query("select r.campaignId as campaignId, count(r.id) as ruleCount from PromotionProductRule r where r.campaignId in :campaignIds group by r.campaignId")
    List<CampaignRuleCount> countGroupedByCampaignIds(@Param("campaignIds") Collection<Long> campaignIds);
    long countByCampaignId(Long campaignId);
    void deleteByCampaignId(Long campaignId);
}
