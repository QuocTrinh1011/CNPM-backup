package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PromotionProductRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromotionProductRuleRepository extends JpaRepository<PromotionProductRule, Long> {
    List<PromotionProductRule> findByCampaignIdOrderByIdAsc(Long campaignId);
    long countByCampaignId(Long campaignId);
    void deleteByCampaignId(Long campaignId);
}
