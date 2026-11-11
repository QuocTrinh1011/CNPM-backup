package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PromotionVoucherRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromotionVoucherRuleRepository extends JpaRepository<PromotionVoucherRule, Long> {
    List<PromotionVoucherRule> findByCampaignIdOrderByIdAsc(Long campaignId);
    long countByCampaignId(Long campaignId);
    void deleteByCampaignId(Long campaignId);
}
