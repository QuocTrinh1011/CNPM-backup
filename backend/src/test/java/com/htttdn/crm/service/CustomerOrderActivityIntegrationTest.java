package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:customerOrderActivity;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.datasource.driver-class-name=org.h2.Driver","spring.datasource.username=sa","spring.datasource.password=","spring.jpa.database-platform=org.hibernate.dialect.H2Dialect","spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
@Transactional
class CustomerOrderActivityIntegrationTest {
    @Autowired EntityManager em;
    @Autowired JdbcTemplate db;
    @Autowired MockMvc mvc;
    @Autowired JwtTokenService jwt;
    @Autowired OrderService service;
    @Autowired CustomerActivityService activities;
    @Autowired PlatformTransactionManager transactions;

    User user(String role) {
        var u=new User();u.setFullName("Verified "+role);u.setEmail(UUID.randomUUID()+"@activity.test");
        u.setPasswordHash("private-hash");u.setRole(role);em.persist(u);em.flush();return u;
    }
    Order order(User customer,String status) {
        var o=new Order();o.setCustomer(customer);o.setOrderCode(Math.abs(UUID.randomUUID().getMostSignificantBits()));
        o.setStatus(status);o.setPaymentMethod("COD");o.setPaymentStatus("COD");o.setTotalAmount(BigDecimal.TEN);
        em.persist(o);em.flush();return o;
    }
    String token(User u){return "Bearer "+jwt.issue(u.getId(),u.getRole());}
    String url(Order o,boolean receipt){return "/api/orders/"+o.getId()+(receipt?"/confirm-receipt":"/cancel");}

    @Test void successfulCustomerActionsAreAtomicPrivateAndIdempotentOnTimeline() throws Exception {
        var buyer=user("CUSTOMER");var other=user("CUSTOMER");var manager=user("MANAGER");
        for(boolean receipt:new boolean[]{false,true}) {
            var o=order(buyer,receipt?"DELIVERED":"PENDING");String action=receipt?"CUSTOMER_RECEIPT":"CUSTOMER_CANCEL";
            for(int i=0;i<2;i++)mvc.perform(patch(url(o,receipt)).header("Authorization",token(buyer))
                .header("X-Actor-Name","forged actor").contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"private cancellation reason\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(receipt?"COMPLETED":"CANCELLED"));
            var log=em.createQuery("select a from AuditLog a where a.targetId=:id and a.action=:action",AuditLog.class)
                .setParameter("id",o.getId()).setParameter("action",action).getSingleResult();
            assertEquals(buyer.getId(),log.getActorId());assertEquals("Verified CUSTOMER",log.getActorName());assertEquals("CUSTOMER",log.getActorRole());
            assertTrue(log.getBeforeData().contains(receipt?"DELIVERED":"PENDING"));
            assertTrue(log.getAfterData().contains(receipt?"COMPLETED":"CANCELLED"));
            for(String secret:new String[]{"private cancellation reason","private-hash",buyer.getEmail(),"forged actor"})
                assertFalse((log.getBeforeData()+log.getAfterData()).contains(secret));
            assertEquals(1,activities.list(buyer.getId(),0,100).content().stream().filter(e->e.targetId()==o.getId()&&e.action().equals(action)).count());
            assertEquals(1,db.queryForObject("select count(*) from customer_notifications where order_id=?",Long.class,o.getId()));
        }
        assertEquals(0,activities.list(other.getId(),0,100).totalElements());
        mvc.perform(get("/api/manager/users/"+buyer.getId()+"/profile/activities").header("Authorization",token(manager)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4));
        mvc.perform(get("/api/manager/users/"+buyer.getId()+"/profile/activities").header("Authorization",token(other)))
            .andExpect(status().isForbidden());
    }

    @Test void failedUnauthorizedAndWrongOwnerRequestsDoNotCreateAudit() throws Exception {
        var buyer=user("CUSTOMER");var other=user("CUSTOMER");var manager=user("MANAGER");
        var pending=order(buyer,"PENDING");var shipped=order(buyer,"SHIPPED");var returning=order(buyer,"DELIVERED");returning.setReturnStatus("REQUESTED");em.flush();
        for(boolean receipt:new boolean[]{false,true}) {
            mvc.perform(patch(url(pending,receipt))).andExpect(status().isUnauthorized());
            mvc.perform(patch(url(pending,receipt)).header("Authorization",token(other))).andExpect(status().isNotFound());
            mvc.perform(patch(url(pending,receipt)).header("Authorization",token(manager))).andExpect(status().isForbidden());
        }
        mvc.perform(patch(url(pending,true)).header("Authorization",token(buyer))).andExpect(status().isConflict());
        mvc.perform(patch(url(returning,true)).header("Authorization",token(buyer))).andExpect(status().isConflict());
        mvc.perform(patch(url(shipped,false)).header("Authorization",token(buyer))).andExpect(status().isConflict());
        assertEquals(0,db.queryForObject("select count(*) from audit_logs",Long.class));
    }

    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void concurrentRetriesAndRollbackKeepSingleEventWithOrder() throws Exception {
        var tx=new TransactionTemplate(transactions);
        long[] ids=tx.execute(s->{var buyer=user("CUSTOMER");return new long[]{buyer.getId(),order(buyer,"PENDING").getId(),order(buyer,"DELIVERED").getId()};});
        var pool=Executors.newFixedThreadPool(2);
        try {
            for(int index=1;index<=2;index++) {
                long orderId=ids[index];boolean receipt=index==2;
                assertThrows(IllegalStateException.class,()->tx.execute(s->{
                    var buyer=em.find(User.class,ids[0]);if(receipt)service.confirmReceipt(buyer,orderId);else service.cancel(buyer,orderId,"private");
                    em.flush();throw new IllegalStateException("rollback");
                }));
                assertEquals(receipt?"DELIVERED":"PENDING",db.queryForObject("select status from orders where order_id=?",String.class,orderId));
                assertEquals(0,db.queryForObject("select count(*) from audit_logs where entity_type='ORDER' and target_id=?",Long.class,orderId));
                var start=new CountDownLatch(1);
                Callable<String> call=()->{start.await();return tx.execute(s->{var buyer=em.find(User.class,ids[0]);return (receipt?service.confirmReceipt(buyer,orderId):service.cancel(buyer,orderId,"private")).status();});};
                var first=pool.submit(call);var second=pool.submit(call);start.countDown();
                assertEquals(receipt?"COMPLETED":"CANCELLED",first.get(15,TimeUnit.SECONDS));
                assertEquals(first.get(),second.get(15,TimeUnit.SECONDS));
                assertEquals(1,db.queryForObject("select count(*) from audit_logs where entity_type='ORDER' and target_id=?",Long.class,orderId));
                assertEquals(1,db.queryForObject("select count(*) from customer_notifications where order_id=?",Long.class,orderId));
            }
        } finally {
            pool.shutdownNow();
            tx.executeWithoutResult(s->{
                db.update("delete from customer_notifications where customer_id=?",ids[0]);
                db.update("delete from audit_logs where actor_id=?",ids[0]);
                db.update("delete from orders where customer_id=?",ids[0]);
                db.update("delete from customers where customer_id=?",ids[0]);
            });
        }
    }
}
