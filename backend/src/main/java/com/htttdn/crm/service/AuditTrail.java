package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.web.context.request.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
public class AuditTrail {
    public static final String ACTOR_ATTRIBUTE="com.htttdn.crm.service.AuditTrail.actor";
    public record Actor(Long id,String name,String role) {}
    public record PromotionProductRuleSnapshot(Long productId,BigDecimal discountPercent) {}
    public record PromotionInvoiceRuleSnapshot(BigDecimal minimumInvoiceAmount,BigDecimal discountPercent) {}
    public record PromotionVoucherRuleSnapshot(Long voucherId,BigDecimal discountPercent) {}
    public record PromotionCampaignSnapshot(Long id,String code,String name,LocalDate startDate,LocalDate endDate,
            List<PromotionProductRuleSnapshot> productRules,List<PromotionInvoiceRuleSnapshot> invoiceRules,
            List<PromotionVoucherRuleSnapshot> voucherRules) {}
    private final AuditLogRepository logs; private final ObjectMapper mapper;
    public AuditTrail(AuditLogRepository logs,ObjectMapper mapper){this.logs=logs;this.mapper=mapper;}
    public static Actor actor(){
        var context=RequestContextHolder.getRequestAttributes();
        return context instanceof ServletRequestAttributes request ? (Actor)request.getRequest().getAttribute(ACTOR_ATTRIBUTE) : null;
    }
    // Explicit allowlist: never serialize entities, requests, tokens, addresses or free-text customer content.
    public static Map<String,Object> snapshot(Object item){
        var m=new TreeMap<String,Object>();
        if(item instanceof User u){m.put("role",u.getRole());m.put("locked",u.isLocked());m.put("deleted",u.getDeletedAt()!=null);}
        else if(item instanceof Order o){m.put("orderCode",o.getOrderCode());m.put("status",o.getStatus());m.put("returnStatus",o.getReturnStatus());m.put("paymentStatus",o.getPaymentStatus());}
        else if(item instanceof StockReceipt r){m.put("receiptCode",r.getReceiptCode());m.put("supplierId",r.getSupplier()==null?null:r.getSupplier().id);m.put("supplierName",r.getSupplierName());m.put("totalCost",r.getTotalCost());m.put("receivedAt",r.getReceivedAt());m.put("status",r.getStatus());}
        else if(item instanceof Product p){m.put("name",p.getName());m.put("price",p.getPrice());m.put("stock",p.getStock());m.put("active",p.isActive());m.put("category",p.getCategory());}
        else if(item instanceof StoreVoucher v){m.put("code",v.getCode());m.put("discountType",v.getDiscountType());m.put("discountValue",v.getDiscountValue());m.put("minOrderAmount",v.getMinOrderAmount());m.put("maxDiscountAmount",v.getMaxDiscountAmount());m.put("usageLimit",v.getUsageLimit());m.put("perCustomerLimit",v.getPerCustomerLimit());m.put("startsAt",v.getStartsAt());m.put("expiresAt",v.getExpiresAt());m.put("active",v.isActive());}
        else if(item instanceof PromotionCampaignSnapshot c){m.put("id",c.id());m.put("code",c.code());m.put("name",c.name());m.put("startDate",c.startDate());m.put("endDate",c.endDate());m.put("productRules",c.productRules());m.put("invoiceRules",c.invoiceRules());m.put("voucherRules",c.voucherRules());}
        else if(item instanceof Feedback f){m.put("status",f.getStatus());m.put("hidden",f.isHidden());m.put("deleted",f.getDeletedAt()!=null);m.put("hasShopResponse",f.getAdminResponse()!=null&&!f.getAdminResponse().isBlank());}
        else if(item instanceof Survey s){m.put("title",s.getTitle());m.put("status",s.getStatus());m.put("audience",s.getAudience());m.put("deleted",s.getDeletedAt()!=null);var r=s.getReward();if(r!=null){m.put("rewardEnabled",r.isEnabled());m.put("rewardType",r.getDiscountType());m.put("rewardValue",r.getDiscountValue());m.put("rewardMinimum",r.getMinOrderAmount());m.put("rewardMaximum",r.getMaxDiscountAmount());m.put("rewardDays",r.getValidDays());}}
        else throw new IllegalArgumentException("Unsupported audit snapshot");
        return m;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void record(String action,String type,Long id,Map<String,Object> before,Map<String,Object> after){
        recordAs(actor(),action,type,id,before,after);
    }
    /** Service callers may pass an actor only after authenticating and checking current database access. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void recordAs(Actor actor,String action,String type,Long id,Map<String,Object> before,Map<String,Object> after){
        if(actor==null)throw new IllegalStateException("Verified audit actor required");
        try {logs.save(new AuditLog(actor.id(),actor.name(),actor.role(),action,type,id,mapper.writeValueAsString(before),mapper.writeValueAsString(after)));}
        catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Cannot encode audit data",e);}
    }
}
