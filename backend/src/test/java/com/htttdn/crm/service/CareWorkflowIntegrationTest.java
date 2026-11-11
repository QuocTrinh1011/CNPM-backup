package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.AuditLogRepository;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:careWorkflow;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "crm.care-reminders.enabled=false"
    })
@AutoConfigureMockMvc
@Transactional
class CareWorkflowIntegrationTest {
  @Autowired EntityManager em;
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;
  @Autowired JwtTokenService jwt;
  @Autowired CareReminderService reminders;
  @Autowired ManagerCareInbox inbox;
  @Autowired CustomerCareService care;
  @Autowired CareOutcomeReportService outcomes;
  @Autowired AuditLogRepository logs;
  @Autowired PlatformTransactionManager transactions;

  User user(String role) {
    var u = new User();
    u.setRole(role);
    u.setFullName("CRM " + role);
    u.setEmail(UUID.randomUUID() + "@workflow.test");
    u.setPasswordHash("SECRET_HASH");
    em.persist(u);
    em.flush();
    return u;
  }

  String token(User user) {
    return "Bearer " + jwt.issue(user.getId(), user.getRole());
  }

  JsonNode postJson(String url, User actor, Object body, int expected) throws Exception {
    return mapper.readTree(
        mvc.perform(
                post(url)
                    .header("Authorization", token(actor))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(body)))
            .andExpect(status().is(expected))
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  JsonNode complete(User actor, JsonNode task, String outcome) throws Exception {
    var body = new LinkedHashMap<String, Object>();
    for (String key : List.of("assigneeId", "title", "description", "dueAt", "version"))
      body.put(key, task.get(key));
    body.put("status", "COMPLETED");
    body.put("outcome", outcome);
    body.put("resultNote", "PRIVATE_RESULT");
    return mapper.readTree(
        mvc.perform(
                patch("/api/manager/care/tasks/" + task.get("id").asLong())
                    .header("Authorization", token(actor))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(body)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  void customerReturnToCareReminderFollowUpProfileOutcomeAndAudit() throws Exception {
    var buyer = user("CUSTOMER");
    var manager = user("MANAGER");
    var assigned = user("MANAGER");
    var outsider = user("CUSTOMER");
    var admin = user("ADMIN");
    var order = new Order();
    order.setCustomer(buyer);
    order.setOrderCode(600016L);
    order.setStatus("DELIVERED");
    order.setPaymentMethod("COD");
    order.setPaymentStatus("COD");
    order.setTotalAmount(BigDecimal.valueOf(499000));
    em.persist(order);
    em.flush();
    mvc.perform(
            post("/api/orders/" + order.getId() + "/return")
                .header("Authorization", token(outsider))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Wrong owner\"}"))
        .andExpect(status().isNotFound());
    postJson(
        "/api/orders/" + order.getId() + "/return",
        buyer,
        Map.of("reason", "PRIVATE_RETURN_REASON"),
        200);
    Instant now = Instant.now();
    var created =
        postJson(
            "/api/manager/care/tasks",
            manager,
            Map.of(
                "customerId",
                buyer.getId(),
                "assigneeId",
                assigned.getId(),
                "title",
                "PRIVATE_TITLE",
                "description",
                "PRIVATE_DESCRIPTION",
                "dueAt",
                now.minusSeconds(60).toString(),
                "sourceType",
                "RETURN_ORDER",
                "sourceId",
                order.getId()),
            201);
    long id = created.get("id").asLong();
    assertEquals(1, reminders.runOnce(now));
    assertEquals(1, inbox.unread(assigned.getId(), now));
    assertEquals(0, inbox.unread(manager.getId(), now));
    var message = inbox.notifications(assigned.getId(), 0, 10, now).page().content().getFirst();
    assertEquals(id, message.taskId());
    mvc.perform(get("/api/manager/care/tasks/" + id).header("Authorization", token(assigned)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sourceId").value(order.getId()));
    var done = complete(assigned, created, "NEEDS_FOLLOW_UP");
    assertEquals("COMPLETED", done.get("status").asText());
    assertEquals(0, inbox.unread(assigned.getId(), Instant.now()));
    var child =
        postJson(
            "/api/manager/care/tasks/" + id + "/follow-up",
            assigned,
            Map.of(
                "assigneeId",
                assigned.getId(),
                "title",
                "Next call",
                "description",
                "PRIVATE_FOLLOW_UP",
                "dueAt",
                now.plusSeconds(86400).toString()),
            201);
    assertEquals(id, child.get("parentTaskId").asLong());
    assertEquals("RETURN_ORDER", child.get("sourceType").asText());
    mvc.perform(
            get("/api/manager/care/my-tasks?group=FOLLOW_UP")
                .header("Authorization", token(assigned)))
        .andExpect(jsonPath("$.totalElements").value(1));
    mvc.perform(
            get("/api/manager/users/" + buyer.getId() + "/care/notes")
                .header("Authorization", token(manager)))
        .andExpect(status().isOk());
    postJson(
        "/api/manager/users/" + buyer.getId() + "/care/notes",
        manager,
        Map.of("content", "PRIVATE_NOTE"),
        201);
    mvc.perform(
            get("/api/manager/users/" + buyer.getId() + "/profile")
                .header("Authorization", token(manager)))
        .andExpect(jsonPath("$.summary.returnOrders").value(1))
        .andExpect(jsonPath("$.summary.completedOrders").value(0));
    var report = outcomes.report(null, null, assigned.getId());
    assertEquals(1, report.counts().completed());
    assertEquals(1, report.counts().needsFollowUp());
    assertEquals(0, report.counts().resolvedRate().intValue());
    complete(assigned, child, "RESOLVED");
    report = outcomes.report(null, null, assigned.getId());
    assertEquals(2, report.counts().completed());
    assertEquals(new BigDecimal("50.00"), report.counts().resolvedRate());
    // Completing care must never complete a return or collect COD implicitly.
    em.refresh(order);
    assertEquals("REQUESTED", order.getReturnStatus());
    assertEquals("DELIVERED", order.getStatus());
    assertEquals("COD", order.getPaymentStatus());
    mvc.perform(get("/api/admin/audit-logs?type=CARE_TASK").header("Authorization", token(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(4));
    mvc.perform(get("/api/admin/audit-logs?type=CARE_NOTE").header("Authorization", token(admin)))
        .andExpect(jsonPath("$.totalElements").value(1));
    for (var log : logs.findAll()) {
      String snapshots = log.getBeforeData() + log.getAfterData();
      for (String secret : List.of("PRIVATE_", "SECRET_HASH", "@workflow.test"))
        assertFalse(snapshots.contains(secret));
    }
    assertTrue(
        logs.findAll().stream()
            .anyMatch(
                l -> l.getActorId().equals(assigned.getId()) && l.getAction().equals("UPDATE")));
  }

  @Test
  void feedbackCareDoesNotResolveOrPublishFeedbackImplicitly() throws Exception {
    var buyer = user("CUSTOMER");
    var manager = user("MANAGER");
    var category = new Category();
    category.setName("Workflow category");
    em.persist(category);
    var product = new Product();
    product.setName("Workflow product");
    product.setCategoryEntity(category);
    product.setPrice(BigDecimal.TEN);
    product.setStock(5);
    em.persist(product);
    var feedback = new Feedback();
    feedback.setCustomer(buyer);
    feedback.setProduct(product);
    feedback.setRating(2);
    feedback.setStatus("NEW");
    feedback.setHidden(true);
    feedback.setComment("PRIVATE_FEEDBACK");
    em.persist(feedback);
    em.flush();
    var task =
        postJson(
            "/api/manager/care/tasks",
            manager,
            Map.of(
                "customerId",
                buyer.getId(),
                "assigneeId",
                manager.getId(),
                "title",
                "Call about feedback",
                "description",
                "",
                "dueAt",
                Instant.now().plusSeconds(3600).toString(),
                "sourceType",
                "FEEDBACK",
                "sourceId",
                feedback.getId()),
            201);
    complete(manager, task, "RESOLVED");
    em.refresh(feedback);
    assertEquals("NEW", feedback.getStatus());
    assertTrue(feedback.isHidden());
    assertEquals(5, product.getStock());
    assertEquals(1, outcomes.report(null, null, manager.getId()).counts().resolved());
    mvc.perform(
            get("/api/manager/users/" + buyer.getId() + "/profile/feedback")
                .header("Authorization", token(manager)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].hidden").value(true));
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void rollingBackCareAlsoRollsBackItsAudit() {
    long before = logs.count();
    var tx = new TransactionTemplate(transactions);
    tx.execute(
        status -> {
          var buyer = user("CUSTOMER");
          var manager = user("MANAGER");
          care.create(
              token(manager),
              new CustomerCareService.CreateTask(
                  buyer.getId(), manager.getId(), "Rollback", "", Instant.now()));
          assertEquals(before + 1, logs.count());
          status.setRollbackOnly();
          return null;
        });
    assertEquals(before, logs.count());
  }
}
