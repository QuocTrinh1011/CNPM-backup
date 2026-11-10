package com.htttdn.crm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PromotionMappingTest {
    @Test
    void campaignAndRuleEntitiesMapToPromotionTables() {
        assertTable(PromotionCampaign.class, "promotion_campaigns");
        assertTable(PromotionProductRule.class, "promotion_product_rules");
        assertTable(PromotionInvoiceRule.class, "promotion_invoice_rules");
        assertTable(PromotionVoucherRule.class, "promotion_voucher_rules");
    }

    @Test
    void campaignAndRulesExposeDiagramFields() throws ReflectiveOperationException {
        assertColumn(PromotionCampaign.class, "code", "campaign_code");
        assertColumn(PromotionCampaign.class, "name", "name");
        assertColumn(PromotionCampaign.class, "startDate", "start_date");
        assertColumn(PromotionCampaign.class, "endDate", "end_date");
        assertColumn(PromotionProductRule.class, "campaignId", "campaign_id");
        assertColumn(PromotionProductRule.class, "productId", "product_id");
        assertColumn(PromotionProductRule.class, "discountPercent", "discount_percent");
        assertColumn(PromotionInvoiceRule.class, "minimumInvoiceAmount", "minimum_invoice_amount");
        assertColumn(PromotionInvoiceRule.class, "discountPercent", "discount_percent");
        assertColumn(PromotionVoucherRule.class, "voucherId", "voucher_id");
        assertColumn(PromotionVoucherRule.class, "discountPercent", "discount_percent");
    }

    private static void assertTable(Class<?> type, String expected) {
        assertNotNull(type.getAnnotation(Entity.class));
        assertEquals(expected, type.getAnnotation(Table.class).name());
    }

    private static void assertColumn(Class<?> type, String fieldName, String expected) throws ReflectiveOperationException {
        Field field = type.getDeclaredField(fieldName);
        assertEquals(expected, field.getAnnotation(Column.class).name());
    }
}
