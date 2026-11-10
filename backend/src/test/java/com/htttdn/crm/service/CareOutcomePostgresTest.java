package com.htttdn.crm.service;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.*;
import java.sql.Timestamp;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="CRM_POSTGRES_QA",matches="true")
@SpringBootTest(properties={"spring.jpa.hibernate.ddl-auto=none"}) @Transactional
class CareOutcomePostgresTest {
    @Autowired JdbcTemplate db;@Autowired EntityManager em;@Autowired CustomerCareService service;@Autowired JwtTokenService jwt;
    User user(String role){var u=new User();u.setFullName("Outcome QA");u.setEmail("care-outcome-"+java.util.UUID.randomUUID()+"@example.test");u.setRole(role);u.setPasswordHash("not-for-login");em.persist(u);em.flush();return u;}
    @Test void migrationOnlyAddsColumnsAndFollowUpsUseSameTableWithRollback() throws Exception {
        try(var connection=db.getDataSource().getConnection()){assertTrue(connection.getMetaData().getURL().startsWith("jdbc:postgresql:"));}
        var customer=user("CUSTOMER");var manager=user("MANAGER");var now=Timestamp.from(Instant.now());
        Long legacy=db.queryForObject("insert into customer_care_tasks(customer_id,assignee_id,title,description,status,due_at,created_by,updated_by,created_at,updated_at,completed_at) values (?,?,'Legacy','', 'COMPLETED',?,?,?,?,?,?) returning id",Long.class,customer.getId(),manager.getId(),now,manager.getId(),manager.getId(),now,now,now);
        for(String file:new String[]{"013_care_sources.sql","014_care_outcomes.sql"}){
            String sql=Files.readString(Path.of("../database/migrations/"+file)).replace("BEGIN;","").replace("COMMIT;","");
            for(int i=0;i<2;i++)for(String statement:sql.split(";"))if(!statement.isBlank())db.execute(statement);
        }
        assertNull(service.detail(legacy).outcome());assertNull(service.detail(legacy).resultNote());
        String auth="Bearer "+jwt.issue(manager.getId(),"MANAGER");var next=service.followUp(auth,legacy,new CustomerCareService.FollowUp(manager.getId(),"Follow","",Instant.now().plusSeconds(3600)));
        assertEquals(legacy,next.parentTaskId());assertEquals(next.id(),service.detail(legacy).followUpTaskId());
        var completed=service.update(auth,next.id(),new CustomerCareService.UpdateTask(next.assigneeId(),next.title(),next.description(),next.dueAt(),"COMPLETED",next.version(),"RESOLVED","Đã giải quyết"));assertEquals("RESOLVED",completed.outcome());
        assertEquals(2,db.queryForObject("select count(*) from customer_care_tasks where customer_id=?",Long.class,customer.getId()));
        assertEquals(1,db.queryForObject("select count(*) from pg_indexes where tablename='customer_care_tasks' and indexname='uq_care_parent_task'",Long.class));
    }
}
