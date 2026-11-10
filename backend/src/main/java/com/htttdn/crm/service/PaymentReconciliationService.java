package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.exception.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.Instant;
import java.util.*;

@Service
public class PaymentReconciliationService {
    public enum Result { UNPAID, PAID, NEEDS_REVIEW, RETRY }
    private final PayosService payos; private final PaymentAttemptRepository attempts; private final PaymentRepository payments;
    private final NotificationService notifications;
    @org.springframework.beans.factory.annotation.Autowired
    public PaymentReconciliationService(PayosService payos,PaymentAttemptRepository attempts,PaymentRepository payments,NotificationService notifications){this.payos=payos;this.attempts=attempts;this.payments=payments;this.notifications=notifications;}
    public PaymentReconciliationService(PayosService payos,PaymentAttemptRepository attempts,PaymentRepository payments,NotificationService notifications,RefundService ignoredLegacyRefundService){this(payos,attempts,payments,notifications);}
    public static void review(Order o,String reason){o.paymentReviewRequired=true;o.paymentReviewReason=reason;o.paymentReviewAt=Instant.now();}
    public static void clearReview(Order o){o.paymentReviewRequired=false;o.paymentReviewReason=null;o.paymentReviewAt=null;}
    @Transactional(propagation=Propagation.MANDATORY) public void paid(Order o,Payment p,PaymentAttempt attempt){
        boolean wasPaid="PAID".equals(o.getPaymentStatus());
        if(!wasPaid&&o.paidAt==null&&"PAYOS".equals(o.getPaymentMethod()))o.paidAt=Instant.now();
        if(attempt!=null){attempt.setStatus("PAID");attempt.setUpdatedAt(Instant.now());attempts.save(attempt);}
        o.setPaymentStatus("PAID");p.setStatus("PAID");o.setUpdatedAt(Instant.now());p.setUpdatedAt(Instant.now());payments.save(p);
        if(!wasPaid)notifications.create(o.getCustomer(),"CANCELLED".equals(o.getStatus())?"Thanh toán sau khi hủy đơn":"Thanh toán thành công",
            "Đơn #"+o.getOrderCode()+("CANCELLED".equals(o.getStatus())?" đã nhận tiền sau khi hủy; hệ thống không tự xử lý khoản tiền này. Cần cửa hàng đối soát thủ công.":" đã thanh toán thành công."),"CANCELLED".equals(o.getStatus())?"PAYMENT_AFTER_CANCEL":"PAYMENT_CONFIRMED",o.getId());
    }
    private record Link(PaymentAttempt attempt,long code,String id){}
    private boolean matches(Order o,Link link,PayosService.ProviderPayment r){return r.orderCode()==link.code&&r.amount()==o.getTotalAmount().longValueExact()&&link.id.equals(r.paymentLinkId());}
    @Transactional(propagation=Propagation.MANDATORY) public Result reconcile(Order o,boolean cancelOpenLinks){
        if(!"PAYOS".equals(o.getPaymentMethod()))return Result.NEEDS_REVIEW;
        try{if(o.getTotalAmount().longValueExact()<=0){review(o,"INVALID_AMOUNT");return Result.NEEDS_REVIEW;}}
        catch(ArithmeticException ex){review(o,"INVALID_AMOUNT");return Result.NEEDS_REVIEW;}
        Payment p=payments.findByOrderId(o.getId()).orElse(null);
        if(p==null){review(o,"MISSING_PAYMENT");return Result.NEEDS_REVIEW;}
        Map<String,Link> links=new LinkedHashMap<>();
        for(PaymentAttempt a:attempts.findByOrderIdOrderByIdAsc(o.getId())){
            if(a.getPaymentLinkId()==null||a.getPaymentLinkId().isBlank()||a.getProviderOrderCode()==null){review(o,"MISSING_LINK");return Result.NEEDS_REVIEW;}
            if(links.putIfAbsent(a.getPaymentLinkId(),new Link(a,a.getProviderOrderCode(),a.getPaymentLinkId()))!=null){review(o,"DUPLICATE_LINK");return Result.NEEDS_REVIEW;}
        }
        if(links.isEmpty()&&p.getPaymentLinkId()!=null&&!p.getPaymentLinkId().isBlank())links.put(p.getPaymentLinkId(),new Link(null,o.getOrderCode(),p.getPaymentLinkId()));
        else if(!links.isEmpty()&&p.getPaymentLinkId()!=null&&!p.getPaymentLinkId().isBlank()&&!links.containsKey(p.getPaymentLinkId())){review(o,"UNMAPPED_LEGACY_LINK");return Result.NEEDS_REVIEW;}
        if(links.isEmpty()){review(o,"MISSING_LINK");return Result.NEEDS_REVIEW;}
        List<Link> paid=new ArrayList<>();Map<Link,String> states=new LinkedHashMap<>();String anomaly=null;
        try {
            for(Link link:links.values()){
                var r=payos.getPayment(link.id);
                if(!matches(o,link,r)){anomaly="PROVIDER_MISMATCH";continue;}
                if(r.amountPaid()<0){anomaly="PROVIDER_MISMATCH";continue;}
                String state=r.status()==null?"":r.status().toUpperCase(Locale.ROOT);
                if("PAID".equals(state)&&r.amountPaid()==r.amount()){paid.add(link);continue;}
                if(r.amountPaid()!=0){anomaly=r.amountPaid()>r.amount()?"OVERPAYMENT":"PARTIAL_PAYMENT";continue;}
                if(!Set.of("PENDING","PROCESSING","EXPIRED","CANCELLED").contains(state)){anomaly="UNKNOWN_PROVIDER_STATUS";continue;}
                states.put(link,state);
            }
            if(paid.isEmpty()&&("PAID".equals(o.getPaymentStatus())||"PAID".equals(p.getStatus())||links.values().stream().anyMatch(l->l.attempt!=null&&"PAID".equals(l.attempt.getStatus()))))anomaly="LOCAL_PROVIDER_CONFLICT";
            if(states.keySet().stream().anyMatch(l->l.attempt!=null&&"PAID".equals(l.attempt.getStatus())))anomaly="LOCAL_PROVIDER_CONFLICT";
            if(cancelOpenLinks&&paid.isEmpty()&&anomaly==null){
                for(var e:states.entrySet())if(Set.of("PENDING","PROCESSING").contains(e.getValue())){
                    var link=e.getKey();payos.cancelPaymentLink(link.id);var r=payos.getPayment(link.id);
                    if(!matches(o,link,r)){anomaly="PROVIDER_MISMATCH";break;}
                    if("PAID".equalsIgnoreCase(r.status())&&r.amountPaid()==r.amount()){paid.add(link);break;}
                    if(r.amountPaid()!=0||!Set.of("EXPIRED","CANCELLED").contains(String.valueOf(r.status()).toUpperCase(Locale.ROOT))){anomaly="CANCEL_NOT_CONFIRMED";break;}
                    e.setValue(r.status().toUpperCase(Locale.ROOT));
                }
            }
            // Once paid, retire any other verified open link to reduce double-payment risk.
            if(!paid.isEmpty()&&anomaly==null){
                for(var e:states.entrySet())if(Set.of("PENDING","PROCESSING").contains(e.getValue())){
                    Link link=e.getKey();payos.cancelPaymentLink(link.id);var r=payos.getPayment(link.id);
                    if(!matches(o,link,r)||r.amountPaid()<0){anomaly="PROVIDER_MISMATCH";break;}
                    String state=String.valueOf(r.status()).toUpperCase(Locale.ROOT);
                    if("PAID".equals(state)&&r.amountPaid()==r.amount()){paid.add(link);continue;}
                    if(r.amountPaid()!=0||!Set.of("EXPIRED","CANCELLED").contains(state)){anomaly="CANCEL_NOT_CONFIRMED";break;}
                    e.setValue(state);
                }
            }
        }catch(ApiException ex){
            for(Link link:paid)paid(o,p,link.attempt);
            review(o,"PROVIDER_UNAVAILABLE");return Result.RETRY;
        }
        for(Link link:paid)paid(o,p,link.attempt);
        if(paid.size()>1)anomaly="MULTIPLE_PAYMENTS";
        if(paid.isEmpty()&&"PAID".equals(o.getPaymentStatus()))anomaly="LOCAL_PROVIDER_CONFLICT";
        if(anomaly!=null){review(o,anomaly);return Result.NEEDS_REVIEW;}
        clearReview(o);
        for(var e:states.entrySet())if(e.getKey().attempt!=null&&Set.of("EXPIRED","CANCELLED").contains(e.getValue())){var a=e.getKey().attempt;a.setStatus(e.getValue());a.setUpdatedAt(Instant.now());attempts.save(a);}
        return paid.isEmpty()?Result.UNPAID:Result.PAID;
    }
}
