package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:careTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class CustomerCareIntegrationTest {
  @Test
  void completingRequiresAnOutcomeAndKeepsLegacyCompletedResultsUnknown() {
    var task = service.create(auth(), create("Outcome", Instant.now()));
    assertThrows(
        ApiException.class,
        () ->
            service.update(
                auth(),
                task.id(),
                new CustomerCareService.UpdateTask(
                    task.assigneeId(),
                    task.title(),
                    task.description(),
                    task.dueAt(),
                    "COMPLETED",
                    task.version())));
    assertThrows(
        ApiException.class,
        () ->
            service.update(
                auth(),
                task.id(),
                new CustomerCareService.UpdateTask(
                    task.assigneeId(),
                    task.title(),
                    task.description(),
                    task.dueAt(),
                    "COMPLETED",
                    task.version(),
                    "BAD",
                    "")));
    assertThrows(
        ApiException.class,
        () ->
            service.update(
                auth(),
                task.id(),
                new CustomerCareService.UpdateTask(
                    task.assigneeId(),
                    task.title(),
                    task.description(),
                    task.dueAt(),
                    "COMPLETED",
                    task.version(),
                    "CONTACTED",
                    "x".repeat(4001))));
    assertThrows(
        ApiException.class,
        () ->
            service.update(
                auth(),
                task.id(),
                new CustomerCareService.UpdateTask(
                    task.assigneeId(),
                    task.title(),
                    task.description(),
                    task.dueAt(),
                    "IN_PROGRESS",
                    task.version(),
                    "CONTACTED",
                    "")));
    for (String outcome :
        new String[] {"CONTACTED", "UNREACHABLE", "RESOLVED", "NEEDS_FOLLOW_UP"}) {
      var t = service.create(auth(), create(outcome, Instant.now()));
      var done =
          service.update(
              auth(),
              t.id(),
              new CustomerCareService.UpdateTask(
                  t.assigneeId(),
                  t.title(),
                  t.description(),
                  t.dueAt(),
                  "COMPLETED",
                  t.version(),
                  outcome,
                  "  Kết quả trao đổi  "));
      assertEquals(outcome, done.outcome());
      assertEquals("Kết quả trao đổi", done.resultNote());
      assertNull(done.followUpTaskId());
      assertThrows(
          ApiException.class,
          () ->
              service.update(
                  auth(),
                  done.id(),
                  new CustomerCareService.UpdateTask(
                      done.assigneeId(),
                      done.title(),
                      done.description(),
                      done.dueAt(),
                      "COMPLETED",
                      done.version(),
                      "RESOLVED",
                      "Cannot overwrite")));
    }
    var legacy = em.find(CustomerCareTask.class, task.id());
    legacy.status = "COMPLETED";
    legacy.completedAt = Instant.now();
    em.flush();
    assertNull(service.detail(task.id()).outcome());
  }

  @Test
  void explicitFollowUpKeepsCustomerSourceAndDoesNotModifyOriginalOrClosedSource() {
    var order = new Order();
    order.setCustomer(customer);
    order.setOrderCode(7654330L);
    order.setStatus("DELIVERED");
    order.setReturnStatus("REQUESTED");
    order.setPaymentMethod("COD");
    order.setPaymentStatus("COD");
    order.setTotalAmount(java.math.BigDecimal.TEN);
    em.persist(order);
    em.flush();
    var task =
        service.create(
            auth(),
            new CustomerCareService.CreateTask(
                customer.getId(),
                other.getId(),
                "Return",
                "",
                Instant.now(),
                "RETURN_ORDER",
                order.getId()));
    var input =
        new CustomerCareService.FollowUp(
            other.getId(), "Call again", "Check satisfaction", Instant.now().plusSeconds(3600));
    assertThrows(ApiException.class, () -> service.followUp(auth(), task.id(), input));
    var done =
        service.update(
            auth(),
            task.id(),
            new CustomerCareService.UpdateTask(
                task.assigneeId(),
                task.title(),
                task.description(),
                task.dueAt(),
                "COMPLETED",
                task.version(),
                "NEEDS_FOLLOW_UP",
                "Call later"));
    order.setReturnStatus("COMPLETED");
    em.flush();
    customer.setLocked(true);
    em.flush();
    assertThrows(
        ApiException.class,
        () ->
            service.followUp(
                auth(),
                done.id(),
                new CustomerCareService.FollowUp(
                    other.getId(), "Past", "", Instant.now().minusSeconds(1))));
    var next = service.followUp(auth(), done.id(), input);
    assertEquals(done.id(), next.parentTaskId());
    assertEquals(done.customerId(), next.customerId());
    assertEquals(done.sourceId(), next.sourceId());
    assertEquals("RETURN_ORDER", next.sourceType());
    assertEquals("TODO", next.status());
    assertNull(next.outcome());
    assertEquals(next.id(), service.detail(done.id()).followUpTaskId());
    assertEquals("NEEDS_FOLLOW_UP", service.detail(done.id()).outcome());
    assertEquals("COMPLETED", order.getReturnStatus());
    assertEquals("COD", order.getPaymentStatus());
    assertEquals(
        "CARE_FOLLOW_UP_EXISTS",
        assertThrows(ApiException.class, () -> service.followUp(auth(), done.id(), input)).code());
  }

  @Test
  void followUpRejectsInactiveAssigneeAndEnforcesManagerRole() throws Exception {
    var task = service.create(auth(), create("Legacy follow-up", Instant.now()));
    var legacy = em.find(CustomerCareTask.class, task.id());
    legacy.status = "COMPLETED";
    legacy.completedAt = Instant.now();
    em.flush();
    other.setLocked(true);
    em.flush();
    assertThrows(
        ApiException.class,
        () ->
            service.followUp(
                auth(),
                task.id(),
                new CustomerCareService.FollowUp(
                    other.getId(), "Call", "", Instant.now().plusSeconds(3600))));
    String body =
        "{\"assigneeId\":"
            + manager.getId()
            + ",\"title\":\"Call\",\"description\":\"\",\"dueAt\":\""
            + Instant.now().plusSeconds(3600)
            + "\"}";
    String url = "/api/manager/care/tasks/" + task.id() + "/follow-up";
    mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isUnauthorized());
    for (User wrong : new User[] {customer, admin})
      mvc.perform(
              post(url)
                  .header("Authorization", "Bearer " + jwt.issue(wrong.getId(), wrong.getRole())))
          .andExpect(status().isForbidden());
    mvc.perform(
            post(url)
                .header("Authorization", auth())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.parentTaskId").value(task.id()));
    assertNull(service.detail(task.id()).outcome());
  }

  @Test
  void sourceTasksDeriveCustomerPreventDuplicateAndPreserveSourceOnEdit() {
    var order = new Order();
    order.setCustomer(customer);
    order.setOrderCode(7654321L);
    order.setStatus("DELIVERED");
    order.setReturnStatus("REQUESTED");
    order.setPaymentMethod("COD");
    order.setPaymentStatus("COD");
    order.setTotalAmount(java.math.BigDecimal.TEN);
    em.persist(order);
    em.flush();
    var preview = service.source("RETURN_ORDER", order.getId());
    assertEquals(customer.getId(), preview.customerId());
    assertNull(preview.openTaskId());
    assertTrue(preview.title().contains("7654321"));
    var input =
        new CustomerCareService.CreateTask(
            null,
            other.getId(),
            preview.title(),
            "Call about return",
            Instant.now(),
            "RETURN_ORDER",
            order.getId());
    var task = service.create(auth(), input);
    assertEquals(customer.getId(), task.customerId());
    assertEquals("RETURN_ORDER", task.sourceType());
    assertEquals(order.getId(), task.sourceId());
    assertEquals(task.id(), service.source("RETURN_ORDER", order.getId()).openTaskId());
    var filtered =
        service.tasks(
            new CustomerCareService.Filters(
                "", null, null, null, null, 0, 1, "RETURN_ORDER", order.getId()));
    assertEquals(1, filtered.totalElements());
    assertEquals(
        "CARE_SOURCE_OPEN",
        assertThrows(ApiException.class, () -> service.create(auth(), input)).code());
    var done = service.update(auth(), task.id(), update(task, "COMPLETED"));
    assertEquals(task.sourceId(), done.sourceId());
    assertNull(service.source("RETURN_ORDER", order.getId()).openTaskId());
    assertNotEquals(task.id(), service.create(auth(), input).id());
    assertEquals("REQUESTED", order.getReturnStatus());
    assertEquals("COD", order.getPaymentStatus());
  }

  @Test
  void sourceValidationAndClosedFeedbackOrReturnCannotCreateTasks() throws Exception {
    var category = new Category();
    category.setName("Care source");
    em.persist(category);
    var product = new Product();
    product.setName("Care source");
    product.setCategoryEntity(category);
    product.setPrice(java.math.BigDecimal.TEN);
    em.persist(product);
    var feedback = new Feedback();
    feedback.setCustomer(customer);
    feedback.setProduct(product);
    feedback.setRating(3);
    feedback.setStatus("NEW");
    em.persist(feedback);
    em.flush();
    var preview = service.source("FEEDBACK", feedback.getId());
    assertEquals(customer.getId(), preview.customerId());
    var wrong =
        new CustomerCareService.CreateTask(
            admin.getId(), other.getId(), "Call", "", Instant.now(), "FEEDBACK", feedback.getId());
    assertThrows(ApiException.class, () -> service.create(auth(), wrong));
    customer.setLocked(true);
    em.flush();
    var task =
        service.create(
            auth(),
            new CustomerCareService.CreateTask(
                customer.getId(),
                other.getId(),
                "Call",
                "",
                Instant.now(),
                "FEEDBACK",
                feedback.getId()));
    assertEquals(customer.getId(), task.customerId());
    for (String type : new String[] {"FEEDBACK", "RETURN_ORDER"}) {
      mvc.perform(get("/api/manager/care/sources/" + type + "/" + feedback.getId()))
          .andExpect(status().isUnauthorized());
      mvc.perform(
              get("/api/manager/care/sources/" + type + "/" + feedback.getId())
                  .header("Authorization", "Bearer " + jwt.issue(admin.getId(), "ADMIN")))
          .andExpect(status().isForbidden());
    }
    mvc.perform(
            get("/api/manager/care/sources/FEEDBACK/" + feedback.getId())
                .header("Authorization", auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.openTaskId").value(task.id()));
    feedback.setStatus("RESOLVED");
    em.flush();
    assertEquals(
        "CARE_SOURCE_CLOSED",
        assertThrows(ApiException.class, () -> service.source("FEEDBACK", feedback.getId()))
            .code());
    assertThrows(
        ApiException.class,
        () ->
            service.create(
                auth(),
                new CustomerCareService.CreateTask(
                    customer.getId(),
                    other.getId(),
                    "Call",
                    "",
                    Instant.now(),
                    "FEEDBACK",
                    feedback.getId())));
    feedback.setDeletedAt(Instant.now());
    em.flush();
    assertEquals(
        404,
        assertThrows(ApiException.class, () -> service.source("FEEDBACK", feedback.getId()))
            .status()
            .value());
    assertThrows(
        ApiException.class,
        () ->
            service.create(
                auth(),
                new CustomerCareService.CreateTask(
                    customer.getId(), other.getId(), "Call", "", Instant.now(), null, 1L)));
    assertThrows(
        ApiException.class,
        () ->
            service.create(
                auth(),
                new CustomerCareService.CreateTask(
                    customer.getId(), other.getId(), "Call", "", Instant.now(), "BAD", 1L)));
    var order = new Order();
    order.setCustomer(customer);
    order.setOrderCode(7654322L);
    order.setStatus("DELIVERED");
    order.setReturnStatus("COMPLETED");
    order.setPaymentMethod("COD");
    order.setPaymentStatus("COD");
    order.setTotalAmount(java.math.BigDecimal.TEN);
    em.persist(order);
    em.flush();
    assertThrows(ApiException.class, () -> service.source("RETURN_ORDER", order.getId()));
  }

  @Autowired CustomerCareService service;
  @Autowired EntityManager em;
  @Autowired JwtTokenService jwt;
  @Autowired MockMvc mvc;
  @Autowired CareDashboardService dashboard;

  @Test
  void dormantCustomersExcludeOpenCareDeletedAndUncompletedPurchases() {
    var now = java.time.LocalDate.now(CustomerLifecycle.ZONE);
    for (int i = 0; i < 12; i++) {
      var u = user("Dormant" + i, "CUSTOMER");
      var o = new Order();
      o.setCustomer(u);
      o.setOrderCode(80000L + i);
      o.setStatus("COMPLETED");
      o.setPaymentMethod("COD");
      o.setPaymentStatus("COD");
      o.setTotalAmount(java.math.BigDecimal.TEN);
      o.setCreatedAt(now.minusDays(30).atTime(23, 59).atZone(CustomerLifecycle.ZONE).toInstant());
      em.persist(o);
    }
    em.flush();
    assertEquals(12, dashboard.dormant(1, 10).totalElements());
    assertEquals(2, dashboard.dormant(1, 10).content().size());
    var id = dashboard.dormant(0, 10).content().getFirst().id();
    service.create(
        auth(), new CustomerCareService.CreateTask(id, other.getId(), "Call", "", Instant.now()));
    assertEquals(11, dashboard.dashboard(null, null, null).dormantWithoutOpenTask());
    var deleted = em.find(User.class, dashboard.dormant(0, 10).content().getFirst().id());
    deleted.setDeletedAt(Instant.now());
    em.flush();
    assertEquals(10, dashboard.dormant(0, 10).totalElements());
  }

  @Test
  void dashboardCountsMatchDrillDownAndEnforcePermissions() throws Exception {
    var due =
        java.time.LocalDate.now(CustomerLifecycle.ZONE)
            .atStartOfDay(CustomerLifecycle.ZONE)
            .toInstant();
    var first = service.create(auth(), create("First", due.minusSeconds(1)));
    service.create(auth(), create("Second", due.plusSeconds(3600)));
    service.update(auth(), first.id(), update(first, "COMPLETED"));
    var result = dashboard.dashboard(null, null, other.getId());
    assertEquals(2, result.counts().total());
    assertEquals(1, result.counts().completed());
    assertEquals(1, result.counts().todo());
    assertEquals(1, result.staff().size());
    var today = java.time.LocalDate.now(CustomerLifecycle.ZONE);
    var scoped = dashboard.dashboard(today, today, other.getId());
    assertEquals(1, scoped.counts().total());
    assertEquals(
        scoped.counts().total(),
        service.tasks(filters("", other.getId(), null, null, 0, 10), today, today).totalElements());
    assertThrows(ApiException.class, () -> dashboard.dashboard(today, today.minusDays(1), null));
    assertThrows(ApiException.class, () -> dashboard.dashboard(null, null, -1L));
    mvc.perform(get("/api/manager/care/dashboard").header("Authorization", auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.counts.total").value(2));
    for (var u : new User[] {customer, admin})
      mvc.perform(
              get("/api/manager/care/dashboard")
                  .header("Authorization", "Bearer " + jwt.issue(u.getId(), u.getRole())))
          .andExpect(status().isForbidden());
    mvc.perform(get("/api/manager/care/dormant").header("Authorization", auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  User customer, manager, other, admin;

  User user(String name, String role) {
    var u = new User();
    u.setFullName(name);
    u.setEmail(name + "@care.test");
    u.setRole(role);
    u.setPasswordHash("secret-not-returned");
    em.persist(u);
    em.flush();
    return u;
  }

  @BeforeEach
  void setup() {
    customer = user("Customer", "CUSTOMER");
    manager = user("Manager", "MANAGER");
    other = user("Other", "MANAGER");
    admin = user("Admin", "ADMIN");
  }

  String auth() {
    return "Bearer " + jwt.issue(manager.getId(), manager.getRole());
  }

  CustomerCareService.CreateTask create(String title, Instant due) {
    return new CustomerCareService.CreateTask(
        customer.getId(), other.getId(), title, "Contact customer", due);
  }

  CustomerCareService.UpdateTask update(CustomerCareService.Task t, String status) {
    return new CustomerCareService.UpdateTask(
        t.assigneeId(),
        t.title(),
        t.description(),
        t.dueAt(),
        status,
        t.version(),
        "COMPLETED".equals(status) ? "CONTACTED" : null,
        null);
  }

  CustomerCareService.Filters filters(
      String q, Long assignee, String status, Boolean overdue, int page, int size) {
    return new CustomerCareService.Filters(q, null, assignee, status, overdue, page, size);
  }

  @Test
  void appendOnlyNotesKeepAuthorAndPaginateForCorrectCustomer() {
    var n =
        service.addNote(
            auth(), customer.getId(), new CustomerCareService.NoteInput("  Call back tomorrow  "));
    assertEquals("Call back tomorrow", n.content());
    assertEquals("Manager", n.authorName());
    service.addNote(auth(), customer.getId(), new CustomerCareService.NoteInput("Second note"));
    assertEquals(2, service.notes(customer.getId(), 1, 1).totalElements());
    assertEquals(1, service.notes(customer.getId(), 1, 1).content().size());
    var empty = user("Empty", "CUSTOMER");
    assertEquals(0, service.notes(empty.getId(), 0, 10).totalElements());
    assertThrows(
        ApiException.class,
        () -> service.addNote(auth(), admin.getId(), new CustomerCareService.NoteInput("test")));
    assertThrows(
        ApiException.class,
        () -> service.addNote(auth(), customer.getId(), new CustomerCareService.NoteInput(" ")));
    assertThrows(
        ApiException.class,
        () ->
            service.addNote(
                auth(), customer.getId(), new CustomerCareService.NoteInput("x".repeat(4001))));
  }

  @Test
  void taskLifecycleOverdueAndStaleEditsAreRejected() {
    var t = service.create(auth(), create("Call", Instant.now().minusSeconds(60)));
    assertEquals("TODO", t.status());
    assertTrue(t.overdue());
    var started = service.update(auth(), t.id(), update(t, "IN_PROGRESS"));
    assertTrue(started.version() > t.version());
    assertEquals(
        409,
        assertThrows(
                ApiException.class, () -> service.update(auth(), t.id(), update(t, "COMPLETED")))
            .status()
            .value());
    assertThrows(ApiException.class, () -> service.update(auth(), t.id(), update(started, "TODO")));
    var done = service.update(auth(), t.id(), update(started, "COMPLETED"));
    assertFalse(done.overdue());
    assertNotNull(done.completedAt());
    assertThrows(
        ApiException.class, () -> service.update(auth(), t.id(), update(done, "IN_PROGRESS")));
  }

  @Test
  void filterBeforePaginationAndKeepInactiveAssigneeHistory() {
    for (int i = 0; i < 15; i++)
      service.create(auth(), create("Matching " + i, Instant.now().minusSeconds(3600 + i)));
    service.create(auth(), create("Future", Instant.now().plusSeconds(3600)));
    var result = service.tasks(filters("Matching", other.getId(), "TODO", true, 1, 10));
    assertEquals(15, result.totalElements());
    assertEquals(2, result.totalPages());
    assertEquals(5, result.content().size());
    assertEquals(1, service.tasks(filters("", null, null, false, 0, 10)).totalElements());
    other.setLocked(true);
    em.flush();
    assertEquals(1, service.staff("Manager", 0, 10).totalElements());
    var t = service.detail(result.content().getFirst().id());
    assertFalse(t.assigneeActive());
    service.update(auth(), t.id(), update(t, "COMPLETED"));
    assertThrows(ApiException.class, () -> service.create(auth(), create("Locked", Instant.now())));
    customer.setDeletedAt(Instant.now());
    em.flush();
    assertEquals(0, service.tasks(filters("", null, null, null, 0, 10)).totalElements());
    assertThrows(ApiException.class, () -> service.notes(customer.getId(), 0, 10));
  }

  @Test
  void validationCustomerLockAndNoInternalAssignment() {
    customer.setLocked(true);
    em.flush();
    assertNotNull(service.create(auth(), create("Locked customer follow-up", Instant.now())).id());
    assertThrows(
        ApiException.class,
        () ->
            service.create(
                auth(),
                new CustomerCareService.CreateTask(
                    customer.getId(), admin.getId(), "Call", "", Instant.now())));
    assertThrows(
        ApiException.class, () -> service.create(auth(), create("x".repeat(256), Instant.now())));
    assertThrows(ApiException.class, () -> service.create(auth(), create("Call", null)));
    assertThrows(ApiException.class, () -> service.tasks(filters("", null, "BAD", null, 0, 10)));
    assertThrows(ApiException.class, () -> service.tasks(filters("", null, null, null, -1, 10)));
  }

  @Test
  void managerOnlyApiAndDtosDoNotExposeAuthenticationData() throws Exception {
    String base = "/api/manager/care/tasks";
    mvc.perform(get(base)).andExpect(status().isUnauthorized());
    for (User wrong : new User[] {customer, admin})
      mvc.perform(
              get(base)
                  .header("Authorization", "Bearer " + jwt.issue(wrong.getId(), wrong.getRole())))
          .andExpect(status().isForbidden());
    service.create(auth(), create("API task", Instant.now().plusSeconds(3600)));
    String body =
        mvc.perform(get(base).header("Authorization", auth()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].status").value("TODO"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertFalse(body.contains("password"));
    assertFalse(body.contains("token"));
    mvc.perform(
            post("/api/manager/users/" + customer.getId() + "/care/notes")
                .header("Authorization", auth())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"API note\"}"))
        .andExpect(status().isCreated());
    mvc.perform(get("/api/manager/care/staff").header("Authorization", auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2));
    String due = Instant.now().plusSeconds(7200).toString();
    String request =
        "{\"customerId\":"
            + customer.getId()
            + ",\"assigneeId\":"
            + other.getId()
            + ",\"title\":\"HTTP task\",\"description\":\"Care\",\"dueAt\":\""
            + due
            + "\"}";
    for (User wrong : new User[] {customer, admin})
      mvc.perform(
              post(base)
                  .header("Authorization", "Bearer " + jwt.issue(wrong.getId(), wrong.getRole()))
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(request))
          .andExpect(status().isForbidden());
    String created =
        mvc.perform(
                post(base)
                    .header("Authorization", auth())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(request))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.version").value(0))
            .andReturn()
            .getResponse()
            .getContentAsString();
    Number id = com.jayway.jsonpath.JsonPath.read(created, "$.id");
    String patch =
        "{\"assigneeId\":"
            + other.getId()
            + ",\"title\":\"HTTP task\",\"description\":\"Care\",\"dueAt\":\""
            + due
            + "\",\"status\":\"COMPLETED\",\"outcome\":\"CONTACTED\",\"version\":0}";
    mvc.perform(
            patch(base + "/" + id)
                .header("Authorization", auth())
                .contentType(MediaType.APPLICATION_JSON)
                .content(patch))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.overdue").value(false));
  }
}
