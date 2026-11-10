package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:surveyGroupTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1","spring.datasource.driver-class-name=org.h2.Driver","spring.datasource.username=sa","spring.datasource.password=","spring.jpa.database-platform=org.hibernate.dialect.H2Dialect","spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc @Transactional
class SurveyRecipientGroupIntegrationTest {
    @Autowired EntityManager em;
    @Autowired JdbcTemplate db;
    @Autowired MockMvc mvc;
    @Autowired JwtTokenService jwt;
    @Autowired ObjectMapper json;
    @Autowired CustomerLifecycleQuery customers;
    long code=60000;
    User user(String name,String role) {
        var u=new User();u.setFullName(name);u.setRole(role);u.setEmail(UUID.randomUUID()+"@survey-group.test");u.setPasswordHash("private");em.persist(u);em.flush();return u;
    }
    void purchase(User u) {
        var o=new Order();o.setCustomer(u);o.setOrderCode(code++);o.setStatus("COMPLETED");o.setPaymentMethod("COD");o.setPaymentStatus("COD");o.setTotalAmount(BigDecimal.TEN);em.persist(o);
    }
    String token(User u){return "Bearer "+jwt.issue(u.getId(),u.getRole());}
    Map<String,Object> request(Map<String,Object> filter) {
        var input=new HashMap<String,Object>();input.put("title","Group survey");input.put("audience","SELECTED");input.put("recipientFilter",filter);
        input.put("questions",List.of(Map.of("text","Question","type","SINGLE_CHOICE","optionsJson","[\"A\",\"B\"]","required",true)));return input;
    }
    long create(User manager,Map<String,Object> input) throws Exception {
        var result=mvc.perform(post("/api/manager/surveys").header("Authorization",token(manager)).contentType("application/json").content(json.writeValueAsString(input)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT")).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }
    @Test void fullFilteredGroupIsSavedNotOnlyPreviewPageAndCountsExcludeLockedDeletedAndStaff() throws Exception {
        var manager=user("Group manager","MANAGER");
        var wanted=new HashSet<Long>();
        for(int i=0;i<13;i++){var u=user("Group buyer "+i,"CUSTOMER");purchase(u);wanted.add(u.getId());}
        var locked=user("Group locked","CUSTOMER");locked.setLocked(true);purchase(locked);
        var deleted=user("Group removed","CUSTOMER");deleted.setDeletedAt(Instant.now());purchase(deleted);purchase(manager);em.flush();
        var filter=Map.<String,Object>of("q","Group","minCompletedOrders",1,"stage","FIRST_PURCHASE");
        mvc.perform(post("/api/manager/surveys/recipients/preview").header("Authorization",token(manager)).contentType("application/json").content(json.writeValueAsString(Map.of("recipientFilter",filter,"page",1,"size",10))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalMatched").value(14)).andExpect(jsonPath("$.eligibleCount").value(13)).andExpect(jsonPath("$.lockedCount").value(1))
            .andExpect(jsonPath("$.recipients.totalPages").value(2)).andExpect(jsonPath("$.recipients.content.length()").value(3));
        long id=create(manager,request(filter));var survey=em.find(Survey.class,id);assertEquals(wanted,survey.getRecipients());
        assertEquals(0,db.queryForObject("select count(*) from customer_notifications",Long.class));
        var latest=user("Group new after draft","CUSTOMER");purchase(latest);em.flush();
        mvc.perform(patch("/api/manager/surveys/"+id+"/publish").header("Authorization",token(manager))).andExpect(status().isOk());
        mvc.perform(patch("/api/manager/surveys/"+id+"/publish").header("Authorization",token(manager))).andExpect(status().isOk());
        assertEquals(13,db.queryForObject("select count(*) from customer_notifications where type='SURVEY_PUBLISHED'",Long.class));
        assertFalse(survey.getRecipients().contains(latest.getId()));
        mvc.perform(get("/api/surveys/"+id).header("Authorization",token(latest))).andExpect(status().isNotFound());
        mvc.perform(post("/api/surveys/"+id+"/responses").header("Authorization",token(latest)).contentType("application/json").content("{\"answers\":[]}")).andExpect(status().isNotFound());
        var owner=em.find(User.class,wanted.iterator().next());
        mvc.perform(get("/api/surveys/"+id).header("Authorization",token(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.recipients").doesNotExist());
    }
    @Test void reevaluatesAtSaveAndRejectsEmptyOrConflictingSelectionWithoutPartialDraft() throws Exception {
        var manager=user("Manager","MANAGER");var buyer=user("Before save","CUSTOMER");var filter=Map.<String,Object>of("q","Before save");
        mvc.perform(post("/api/manager/surveys/recipients/preview").header("Authorization",token(manager)).contentType("application/json").content(json.writeValueAsString(Map.of("recipientFilter",filter))))
            .andExpect(jsonPath("$.eligibleCount").value(1));
        buyer.setLocked(true);em.flush();
        mvc.perform(post("/api/manager/surveys").header("Authorization",token(manager)).contentType("application/json").content(json.writeValueAsString(request(filter)))).andExpect(status().isBadRequest());
        assertEquals(0,db.queryForObject("select count(*) from survey_definitions",Long.class));
        buyer.setLocked(false);var added=user("Before save added","CUSTOMER");em.flush();
        var conflict=request(filter);conflict.put("customerIds",List.of(buyer.getId()));
        mvc.perform(post("/api/manager/surveys").header("Authorization",token(manager)).contentType("application/json").content(json.writeValueAsString(conflict))).andExpect(status().isBadRequest());
        var all=request(filter);all.put("audience","ALL");
        mvc.perform(post("/api/manager/surveys").header("Authorization",token(manager)).contentType("application/json").content(json.writeValueAsString(all))).andExpect(status().isBadRequest());
        var id=create(manager,request(filter));assertEquals(Set.of(buyer.getId(),added.getId()),em.find(Survey.class,id).getRecipients());
    }
    @Test void previewValidatesFiltersAndRequiresManager() throws Exception {
        var manager=user("Manager","MANAGER");var buyer=user("Buyer","CUSTOMER");var admin=user("Root","ADMIN");
        String url="/api/manager/surveys/recipients/preview";
        mvc.perform(post(url).contentType("application/json").content("{\"recipientFilter\":{}}" )).andExpect(status().isUnauthorized());
        for(var wrong:List.of(buyer,admin))mvc.perform(post(url).header("Authorization",token(wrong)).contentType("application/json").content("{\"recipientFilter\":{}}" )).andExpect(status().isForbidden());
        for(var input:List.of(Map.of("recipientFilter",Map.of("minRating",6)),Map.of("recipientFilter",Map.of("stage","BAD")),Map.of("recipientFilter",Map.of(),"page",-1),Map.of("recipientFilter",Map.of(),"size",101)))
            mvc.perform(post(url).header("Authorization",token(manager)).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isBadRequest());
    }
    @Test void combinedRatingSurveyPurchaseAndVietnamDateFiltersMatchCustomerList() throws Exception {
        var manager=user("Manager","MANAGER");
        var category=new Category();category.setName("Survey filters");em.persist(category);
        var product=new Product();product.setName("Product");product.setCategoryEntity(category);product.setPrice(BigDecimal.TEN);em.persist(product);
        db.update("insert into survey_definitions(id,title,status,created_at,deleted_at) values(11001,'Archived','DRAFT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        var day=java.time.LocalDate.now(CustomerLifecycle.ZONE).minusDays(30);Long expected=null;
        for(int i=0;i<4;i++){
            var u=user("Group_"+i,"CUSTOMER");if(i==0)expected=u.getId();
            var o=new Order();o.setCustomer(u);o.setOrderCode(code++);o.setStatus("COMPLETED");o.setPaymentMethod("COD");o.setPaymentStatus("COD");o.setTotalAmount(new BigDecimal("1000"));
            o.setCreatedAt(day.plusDays(i==3?1:0).atTime(23,59).atZone(CustomerLifecycle.ZONE).toInstant());em.persist(o);
            var feedback=new Feedback();feedback.setCustomer(u);feedback.setProduct(product);feedback.setRating(i==1?2:4);feedback.setHidden(true);em.persist(feedback);em.flush();
            if(i!=2)db.update("insert into survey_responses(customer_id,survey_id,created_at) values(?,11001,CURRENT_TIMESTAMP)",u.getId());
        }
        var filter=new CustomerLifecycleQuery.RecipientFilter("Group_",null,true,1L,1L,new BigDecimal("1000"),new BigDecimal("1000"),day,day,new BigDecimal("3.5"),new BigDecimal("4.5"),true);
        var preview=customers.preview(filter,0,1);
        assertEquals(1,preview.eligibleCount());assertEquals(expected.longValue(),preview.recipients().content().getFirst().id());
        assertEquals(customers.list(filter.filters(0,1)).totalElements(),preview.totalMatched());
        var id=create(manager,request(json.convertValue(filter,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){})));
        assertEquals(Set.of(expected),em.find(Survey.class,id).getRecipients());
    }
    @Test void specificSurveyFiltersOnlyInvitedCustomersAndNeverConfusesOtherSurveyResponses() throws Exception {
        var manager=user("Manager","MANAGER");var waiting=user("Waiting","CUSTOMER");var answered=user("Answered","CUSTOMER");var outside=user("Not invited","CUSTOMER");
        var selected=new Survey();selected.setTitle("Selected archived survey");selected.setAudience("SELECTED");selected.setDeletedAt(Instant.now());
        selected.getRecipients().addAll(Set.of(waiting.getId(),answered.getId()));em.persist(selected);
        var other=new Survey();other.setTitle("Other survey");em.persist(other);em.flush();
        db.update("insert into survey_responses(customer_id,survey_id,created_at) values(?,?,CURRENT_TIMESTAMP)",waiting.getId(),other.getId());
        db.update("insert into survey_responses(customer_id,survey_id,created_at) values(?,?,CURRENT_TIMESTAMP)",answered.getId(),selected.getId());
        String base="/api/manager/users?surveyId="+selected.getId()+"&size=1";
        mvc.perform(get(base+"&surveyed=false").header("Authorization",token(manager))).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(waiting.getId()));
        mvc.perform(get(base+"&surveyed=true").header("Authorization",token(manager))).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(answered.getId()));
        mvc.perform(get(base).header("Authorization",token(manager))).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/manager/users?surveyed=false").header("Authorization",token(manager)))
            .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(outside.getId()));
        var filter=Map.<String,Object>of("surveyId",selected.getId(),"surveyed",false);
        mvc.perform(post("/api/manager/surveys/recipients/preview").header("Authorization",token(manager)).contentType("application/json")
            .content(json.writeValueAsString(Map.of("recipientFilter",filter)))).andExpect(jsonPath("$.eligibleCount").value(1));
        long id=create(manager,request(filter));assertEquals(Set.of(waiting.getId()),em.find(Survey.class,id).getRecipients());
        assertEquals(0,db.queryForObject("select count(*) from customer_notifications",Long.class));
        other.setDeletedAt(Instant.now());em.flush();
        mvc.perform(get("/api/manager/users?surveyId="+other.getId()+"&surveyed=false").header("Authorization",token(manager)))
            .andExpect(jsonPath("$.totalElements").value(2)); // ALL scope: answered-on-other and not-invited have not answered this one.
    }
    @Test void surveyPickerSearchPaginationArchivedSelectionAndInvalidIdsAreSafe() throws Exception {
        var manager=user("Manager","MANAGER");var buyer=user("Buyer","CUSTOMER");
        for(int i=0;i<12;i++){var s=new Survey();s.setTitle("History "+i);em.persist(s);}var archived=new Survey();archived.setTitle("Archived record");archived.setDeletedAt(Instant.now());em.persist(archived);em.flush();
        String url="/api/manager/surveys/filter-options?q=History&size=10&page=1&selectedId="+archived.getId();
        mvc.perform(get(url).header("Authorization",token(manager))).andExpect(status().isOk())
            .andExpect(jsonPath("$.options.totalElements").value(12)).andExpect(jsonPath("$.options.content.length()").value(2))
            .andExpect(jsonPath("$.selected.title").value("Archived record")).andExpect(jsonPath("$.selected.deleted").value(true))
            .andExpect(jsonPath("$.selected.recipients").doesNotExist()).andExpect(jsonPath("$.selected.answers").doesNotExist());
        mvc.perform(get(url)).andExpect(status().isUnauthorized());
        mvc.perform(get(url).header("Authorization",token(buyer))).andExpect(status().isForbidden());
        for(String suffix:List.of("surveyId=0","surveyId=9999999","surveyId=-1"))
            mvc.perform(get("/api/manager/users?"+suffix).header("Authorization",token(manager))).andExpect(status().isBadRequest());
        for(String suffix:List.of("selectedId=9999999","size=101","page=-1"))
            mvc.perform(get("/api/manager/surveys/filter-options?"+suffix).header("Authorization",token(manager))).andExpect(status().isBadRequest());
    }
}
