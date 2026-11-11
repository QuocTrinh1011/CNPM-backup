package com.htttdn.crm.service;

import com.htttdn.crm.entity.PromotionCampaign;
import com.htttdn.crm.repository.CampaignRuleCount;
import com.htttdn.crm.repository.ProductRepository;
import com.htttdn.crm.repository.PromotionCampaignRepository;
import com.htttdn.crm.repository.PromotionInvoiceRuleRepository;
import com.htttdn.crm.repository.PromotionProductRuleRepository;
import com.htttdn.crm.repository.PromotionVoucherRuleRepository;
import com.htttdn.crm.repository.StoreVoucherRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PromotionCampaignServiceTest {
    @Mock PromotionCampaignRepository campaigns;
    @Mock PromotionProductRuleRepository productRules;
    @Mock PromotionInvoiceRuleRepository invoiceRules;
    @Mock PromotionVoucherRuleRepository voucherRules;
    @Mock ProductRepository products;
    @Mock StoreVoucherRepository vouchers;

    @Test
    void summarizesPageWithoutCountingEachCampaignSeparately() {
        var first = campaign(1L, "SUMMER", "Summer");
        var second = campaign(2L, "WINTER", "Winter");
        when(campaigns.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(first, second), PageRequest.of(0, 10), 2));
        when(productRules.countGroupedByCampaignIds(List.of(1L, 2L))).thenReturn(List.of(new RuleCount(1L, 2), new RuleCount(2L, 3)));
        when(invoiceRules.countGroupedByCampaignIds(List.of(1L, 2L))).thenReturn(List.of(new RuleCount(1L, 1)));
        when(voucherRules.countGroupedByCampaignIds(List.of(1L, 2L))).thenReturn(List.of(new RuleCount(2L, 4)));

        var result = service().list("", 0, 10);

        assertEquals(2, result.getContent().size());
        assertEquals(2, result.getContent().get(0).productRuleCount());
        assertEquals(3, result.getContent().get(1).productRuleCount());
        assertEquals(1, result.getContent().get(0).invoiceRuleCount());
        assertEquals(0, result.getContent().get(1).invoiceRuleCount());
        assertEquals(0, result.getContent().get(0).voucherRuleCount());
        assertEquals(4, result.getContent().get(1).voucherRuleCount());
        verify(productRules).countGroupedByCampaignIds(List.of(1L, 2L));
        verify(invoiceRules).countGroupedByCampaignIds(List.of(1L, 2L));
        verify(voucherRules).countGroupedByCampaignIds(List.of(1L, 2L));
        verify(productRules, never()).countByCampaignId(anyLong());
        verify(invoiceRules, never()).countByCampaignId(anyLong());
        verify(voucherRules, never()).countByCampaignId(anyLong());
    }

    @Test
    void skipsRuleCountQueriesForAnEmptyPage() {
        when(campaigns.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

        var result = service().list("", 0, 10);

        assertEquals(0, result.getTotalElements());
        verifyNoInteractions(productRules, invoiceRules, voucherRules);
    }

    private PromotionCampaignService service() {
        return new PromotionCampaignService(campaigns, productRules, invoiceRules, voucherRules, products, vouchers);
    }

    private static PromotionCampaign campaign(long id, String code, String name) {
        var campaign = mock(PromotionCampaign.class);
        when(campaign.getId()).thenReturn(id);
        when(campaign.getCode()).thenReturn(code);
        when(campaign.getName()).thenReturn(name);
        when(campaign.getStartDate()).thenReturn(LocalDate.parse("2026-01-01"));
        when(campaign.getEndDate()).thenReturn(LocalDate.parse("2026-01-31"));
        return campaign;
    }

    private record RuleCount(Long campaignId, long ruleCount) implements CampaignRuleCount {
        @Override public Long getCampaignId() { return campaignId; }
        @Override public long getRuleCount() { return ruleCount; }
    }
}
