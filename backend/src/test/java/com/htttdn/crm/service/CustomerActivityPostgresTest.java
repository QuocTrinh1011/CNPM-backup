package com.htttdn.crm.service;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="CRM_POSTGRES_QA",matches="true")
@SpringBootTest(properties={"spring.jpa.hibernate.ddl-auto=none"})
@Transactional
class CustomerActivityPostgresTest {
    @Autowired JdbcTemplate db;
    @Autowired CustomerActivityService activities;
    @Autowired CustomerLifecycleQuery customers;
    @Test void timelineFiltersAndResolvedCountUseOnlyTemporaryTables() {
        // No public table data, sequences or schema are modified.
        db.execute("create temporary table customers(customer_id bigint primary key,full_name varchar,email varchar,phone varchar,age integer,preferences varchar,created_at timestamptz,locked boolean,lock_reason varchar,role varchar,deleted_at timestamptz) on commit drop");
        db.execute("create temporary table orders(order_id bigint primary key,customer_id bigint,status varchar,total_amount numeric,created_at timestamptz) on commit drop");
        db.execute("create temporary table feedback(feedback_id bigint primary key,customer_id bigint,rating integer,deleted_at timestamptz,created_at timestamptz) on commit drop");
        db.execute("create temporary table survey_responses(id bigint primary key,customer_id bigint,survey_id bigint,created_at timestamptz) on commit drop");
        db.execute("create temporary table survey_definitions(id bigint primary key,title varchar,status varchar,audience varchar,created_at timestamptz,deleted_at timestamptz) on commit drop");
        db.execute("create temporary table survey_recipients(survey_id bigint,customer_id bigint) on commit drop");
        db.execute("create temporary table audit_logs(id bigint primary key,entity_type varchar,target_id bigint,action varchar,created_at timestamptz) on commit drop");
        db.update("insert into customers(customer_id,full_name,email,role,created_at,locked) values(1,'Buyer','buyer@test','CUSTOMER',CURRENT_TIMESTAMP,true),(2,'Other','other@test','CUSTOMER',CURRENT_TIMESTAMP,false),(3,'Staff','staff@test','MANAGER',CURRENT_TIMESTAMP,false)");
        db.update("insert into orders values(10,1,'COMPLETED',100,CURRENT_TIMESTAMP),(20,2,'PENDING',100,CURRENT_TIMESTAMP)");
        db.update("insert into feedback values(1,1,2,null,CURRENT_TIMESTAMP),(2,1,4,null,CURRENT_TIMESTAMP),(3,1,5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        db.update("insert into survey_responses values(1,1,100,CURRENT_TIMESTAMP)");
        db.update("insert into audit_logs values(1,'ORDER',10,'UPDATE',CURRENT_TIMESTAMP),(2,'SUPPORT_TICKET',1,'UPDATE',CURRENT_TIMESTAMP)");
        assertEquals(5,activities.list(1,0,1).totalElements());
        assertEquals(1,activities.list(2,0,10).totalElements());
        var filters=new CustomerLifecycleQuery.Filters(null,null,null,null,null,null,null,null,null,"createdAt","desc",0,1,new BigDecimal("3"),new BigDecimal("3"),true);
        assertEquals(1,customers.list(filters).totalElements());
        assertEquals(1,customers.list(filters).content().getFirst().id());
        var recipients=new CustomerLifecycleQuery.RecipientFilter(null,null,null,null,null,null,null,null,null,new BigDecimal("3"),new BigDecimal("3"),true);
        var preview=customers.preview(recipients,0,1);assertEquals(1,preview.totalMatched());assertEquals(1,preview.lockedCount());assertEquals(0,preview.eligibleCount());
        db.update("update customers set locked=false where customer_id=1");
        assertEquals(1,customers.preview(recipients,0,1).eligibleCount());assertEquals(java.util.List.of(1L),customers.recipientIds(recipients));
        db.update("insert into survey_definitions values(100,'Other','PUBLISHED','ALL',CURRENT_TIMESTAMP,null),(200,'Archived selected','DRAFT','SELECTED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        db.update("insert into survey_recipients values(200,1)");
        var waiting=new CustomerLifecycleQuery.RecipientFilter(null,null,null,null,null,null,null,null,null,null,null,false,200L);
        assertEquals(java.util.List.of(1L),customers.recipientIds(waiting)); // response to survey 100 does not count as survey 200.
        assertEquals(1,customers.preview(waiting,0,1).totalMatched());
        db.update("insert into survey_responses values(2,1,200,CURRENT_TIMESTAMP)");
        assertTrue(customers.recipientIds(waiting).isEmpty());assertTrue(customers.surveyOptions("Other",0,1,200L).selected().deleted());
    }
}
