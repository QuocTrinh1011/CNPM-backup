package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.security.JwtTokenService;
import com.htttdn.crm.exception.ApiException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:cashflow;MODE=PostgreSQL;DB_CLOSE_DELAY=-1","spring.datasource.driver-class-name=org.h2.Driver","spring.datasource.username=sa","spring.datasource.password=","spring.jpa.database-platform=org.hibernate.dialect.H2Dialect","spring.jpa.hibernate.ddl-auto=create-drop","crm.care-reminders.enabled=false"})
@AutoConfigureMockMvc @Transactional
class CashflowReportIntegrationTest {
    @Autowired CashflowReportService report;@Autowired EntityManager em;@Autowired PaymentReconciliationService reconciliation;@Autowired MockMvc mvc;@Autowired JwtTokenService jwt;
    final Instant from=Instant.parse("2026-09-30T17:00:00Z"),to=Instant.parse("2026-10-02T17:00:00Z");
    User user(String role){var u=new User();u.setEmail(UUID.randomUUID()+"@cashflow.test");u.setFullName(role);u.setRole(role);u.setPasswordHash("test-only");em.persist(u);return u;}
    Order order(String method,String status,String payment,long total,Instant paid){var o=new Order();o.setCustomer(user("CUSTOMER"));o.setOrderCode(Math.abs(UUID.randomUUID().getLeastSignificantBits()%900000000000L));o.setPaymentMethod(method);o.setPaymentStatus(payment);o.setStatus(status);o.setTotalAmount(BigDecimal.valueOf(total));o.paidAt=paid;em.persist(o);return o;}
    void refund(Order o,long amount,String status,Instant at){var r=new OrderRefund();r.order=o;r.reasonType="RETURN";r.amount=BigDecimal.valueOf(amount);r.status=status;r.requestKey=UUID.randomUUID().toString();r.processedAt=at;r.bankReference="TEST";r.processingNote="TEST";em.persist(r);}
    void item(Order o,int count,long unit){var c=new Category();c.setName("Category");em.persist(c);var p=new Product();p.setCategoryEntity(c);p.setName("Sản phẩm thử");p.setPrice(BigDecimal.valueOf(unit));em.persist(p);for(int i=0;i<count;i++){var line=new OrderItem();line.setOrder(o);line.setProduct(p);line.setQuantity(1);line.setUnitPrice(BigDecimal.valueOf(unit));em.persist(line);}}
    @Test void receiptsAndRefundsUseVietnamDaysWithoutMultiplyingItems(){
        var cancelled=order("PAYOS","CANCELLED","PAID",100000,from);item(cancelled,3,100000);
        var cod=order("COD","DELIVERED","PAID",200000,null);cod.codCollectedAt=Instant.parse("2026-10-01T16:59:59Z");cod.codCollectedAmount=BigDecimal.valueOf(200000);item(cod,2,150000);
        order("COD","DELIVERED","COD",999999,null);order("PAYOS","PENDING","PENDING",999999,null);order("PAYOS","COMPLETED","PAID",50000,null);order("PAYOS","COMPLETED","PAID",0,from);
        refund(cancelled,30000,"COMPLETED",Instant.parse("2026-10-01T17:00:00Z"));refund(cancelled,70000,"PENDING",null);em.flush();
        var r=report.report(from,to,"day");assertEquals(0,BigDecimal.valueOf(300000).compareTo(r.collected()));assertEquals(0,BigDecimal.valueOf(30000).compareTo(r.refunded()));assertEquals(0,BigDecimal.valueOf(270000).compareTo(r.net()));assertEquals(2,r.collectedOrders());
        assertEquals(2,r.series().size());assertEquals("2026-10-01",r.series().getFirst().period());assertEquals(0,BigDecimal.valueOf(-30000).compareTo(r.series().getLast().net()));assertEquals(1,r.unknownMilestone().orders());assertEquals(0,BigDecimal.valueOf(50000).compareTo(r.unknownMilestone().amount()));
        assertEquals(1,r.topProducts().size());assertEquals(2,r.topProducts().getFirst().quantity());assertEquals(0,BigDecimal.valueOf(300000).compareTo(r.topProducts().getFirst().grossItemValue()));
        var month=report.report(from,to,"month");assertEquals(1,month.series().size());assertEquals("2026-10",month.series().getFirst().period());assertEquals(0,r.net().compareTo(month.net()));
    }
    @Test void refundForAnOlderReceiptMakesThePeriodNegative(){var o=order("PAYOS","CANCELLED","PAID",100000,from.minus(Duration.ofDays(40)));refund(o,100000,"COMPLETED",from.plusSeconds(10));em.flush();var r=report.report(from,to,"day");assertEquals(0,r.collectedOrders());assertEquals(0,BigDecimal.valueOf(-100000).compareTo(r.net()));}
    @Test void emptyDaysAndDefaultsAndInvalidRanges(){var r=report.report(from,to,"day");assertEquals(2,r.series().size());assertEquals(0,r.collected().signum());assertEquals(30,report.report(null,null,"day").series().size());assertThrows(ApiException.class,()->report.report(to,from,"day"));assertThrows(ApiException.class,()->report.report(from,from.plus(Duration.ofDays(367)),"day"));assertThrows(ApiException.class,()->report.report(from,to,"week"));assertThrows(ApiException.class,()->report.report(from,null,"day"));}
    @Test void onlyManagersCanReadTheCurrentSalesReport()throws Exception{String path="/api/manager/reports/sales-statistics?year=2026&groupBy=quarter";for(String role:new String[]{"CUSTOMER","ADMIN"})mvc.perform(get(path).header("Authorization","Bearer "+jwt.issue(user(role).getId(),role))).andExpect(status().isForbidden());mvc.perform(get(path)).andExpect(status().isUnauthorized());mvc.perform(get(path).header("Authorization","Bearer "+jwt.issue(user("MANAGER").getId(),"MANAGER"))).andExpect(status().isOk());}
    @Test void firstConfirmationHasAnImmutableMilestoneAndLegacyPaidIsNotBackfilled(){
        var o=order("PAYOS","PENDING","PENDING",100000,null);var p=new Payment();p.setOrder(o);p.setAmount(o.getTotalAmount());em.persist(p);reconciliation.paid(o,p,null);Instant at=o.paidAt;assertNotNull(at);reconciliation.paid(o,p,null);assertEquals(at,o.paidAt);
        var legacy=order("PAYOS","COMPLETED","PAID",100000,null);var old=new Payment();old.setOrder(legacy);old.setAmount(legacy.getTotalAmount());old.setStatus("PAID");em.persist(old);reconciliation.paid(legacy,old,null);assertNull(legacy.paidAt);
    }
}
