package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.AuditLogRepository;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:support;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "crm.care-reminders.enabled=false"
    })
@AutoConfigureMockMvc
@Transactional
class SupportTicketIntegrationTest {
  @Autowired SupportTicketService service;
  @Autowired EntityManager em;
  @Autowired ManagerCareInbox inbox;
  @Autowired AuditLogRepository logs;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  @Autowired PlatformTransactionManager transactions;

  User user(String role) {
    var u = new User();
    u.setFullName("Support " + role);
    u.setEmail(UUID.randomUUID() + "@support.test");
    u.setPasswordHash("SECRET_HASH");
    u.setRole(role);
    em.persist(u);
    em.flush();
    return u;
  }

  String key() {
    return UUID.randomUUID().toString();
  }

  String auth(User u) {
    return "Bearer " + jwt.issue(u.getId(), u.getRole());
  }

  SupportTicketService.Actor actor(User u) {
    return new SupportTicketService.Actor(u.getId(), "MANAGER".equals(u.getRole()));
  }

  SupportTicketService.Create input(Long c, Long o, Long a) {
    return new SupportTicketService.Create(c, o, a, "Help order", "PRIVATE_DESCRIPTION", key());
  }

  @Test
  void customerCreatesOwnTicketAndManagerHandlesWaitingCustomerReplyThenResolution() {
    var buyer = user("CUSTOMER");
    var manager = user("MANAGER");
    var create = input(null, null, null);
    var ticket = service.create(actor(buyer), create).ticket();
    assertEquals(ticket.id(), service.create(actor(buyer), create).ticket().id());
    assertEquals(1, service.list(actor(buyer), "Help", null, null, null, 0, 1).totalElements());
    assertNull(ticket.customerEmail());
    assertNull(ticket.assigneeId());
    final var initial = ticket;
    assertThrows(
        ApiException.class,
        () ->
            service.update(
                actor(manager),
                initial.id(),
                new SupportTicketService.Update(
                    manager.getId(), "RESOLVED", initial.version(), "Solved", key())));
    ticket =
        service
            .update(
                actor(manager),
                ticket.id(),
                new SupportTicketService.Update(
                    manager.getId(), "IN_PROGRESS", ticket.version(), "", null))
            .ticket();
    assertEquals(1, inbox.unread(manager.getId(), Instant.now()));
    assertEquals(
        ticket.id(),
        inbox
            .notifications(manager.getId(), 0, 10, Instant.now())
            .page()
            .content()
            .getFirst()
            .ticketId());
    var hidden = new SupportTicketService.Reply("PRIVATE_INTERNAL", true, key());
    service.reply(actor(manager), ticket.id(), hidden);
    assertEquals(0, service.detail(actor(buyer), ticket.id()).messages().size());
    assertEquals(1, service.detail(actor(manager), ticket.id()).messages().size());
    ticket = service.detail(actor(manager), ticket.id()).ticket();
    var wait =
        new SupportTicketService.Update(
            manager.getId(), "WAITING_CUSTOMER", ticket.version(), "Please clarify", key());
    service.update(actor(manager), ticket.id(), wait);
    service.update(actor(manager), ticket.id(), wait);
    var reply = new SupportTicketService.Reply("Customer answer", false, key());
    service.reply(actor(buyer), ticket.id(), reply);
    service.reply(actor(buyer), ticket.id(), reply);
    var detail = service.detail(actor(manager), ticket.id());
    assertEquals("IN_PROGRESS", detail.ticket().status());
    assertEquals(3, detail.messages().size());
    var resolve =
        new SupportTicketService.Update(
            manager.getId(), "RESOLVED", detail.ticket().version(), "Solution for customer", key());
    service.update(actor(manager), ticket.id(), resolve);
    service.update(actor(manager), ticket.id(), resolve);
    assertEquals(0, inbox.unread(manager.getId(), Instant.now()));
    assertThrows(
        ApiException.class,
        () ->
            service.reply(
                actor(buyer),
                detail.ticket().id(),
                new SupportTicketService.Reply("Another", false, key())));
    for (var log : logs.findAll())
      assertFalse((log.getBeforeData() + log.getAfterData()).contains("PRIVATE_"));
  }

  @Test
  void managerCreatesForLockedCustomerButMustUseOwnedOrderAndActiveAssignee() {
    var buyer = user("CUSTOMER");
    buyer.setLocked(true);
    var other = user("CUSTOMER");
    var manager = user("MANAGER");
    var inactive = user("MANAGER");
    inactive.setLocked(true);
    var order = new Order();
    order.setCustomer(buyer);
    order.setOrderCode(554411L);
    order.setTotalAmount(BigDecimal.TEN);
    order.setPaymentMethod("COD");
    order.setPaymentStatus("COD");
    order.setStatus("DELIVERED");
    em.persist(order);
    em.flush();
    assertThrows(
        ApiException.class,
        () -> service.create(actor(manager), input(other.getId(), order.getId(), manager.getId())));
    assertThrows(
        ApiException.class,
        () ->
            service.create(actor(manager), input(buyer.getId(), order.getId(), inactive.getId())));
    var t =
        service
            .create(actor(manager), input(buyer.getId(), order.getId(), manager.getId()))
            .ticket();
    assertEquals(buyer.getId(), t.customerId());
    assertEquals(554411L, t.orderCode());
    service.update(
        actor(manager),
        t.id(),
        new SupportTicketService.Update(manager.getId(), "IN_PROGRESS", t.version(), "", null));
    em.refresh(order);
    assertEquals("DELIVERED", order.getStatus());
    assertEquals("COD", order.getPaymentStatus());
    assertEquals(0, BigDecimal.TEN.compareTo(order.getTotalAmount()));
    assertEquals(2, logs.count());
  }

  @Test
  void versionConflictValidationAndFiltersApplyBeforePagination() {
    var buyer = user("CUSTOMER");
    var manager = user("MANAGER");
    for (int i = 0; i < 3; i++)
      service.create(
          actor(buyer),
          new SupportTicketService.Create(null, null, null, "Find " + i, "Description", key()));
    var first = service.list(actor(manager), "Find", null, buyer.getId(), null, 1, 1);
    assertEquals(3, first.totalElements());
    assertEquals(3, first.totalPages());
    assertEquals(1, first.content().size());
    var t = first.content().getFirst();
    service.update(
        actor(manager),
        t.id(),
        new SupportTicketService.Update(manager.getId(), "IN_PROGRESS", t.version(), "", null));
    assertEquals(
        "SUPPORT_CHANGED",
        assertThrows(
                ApiException.class,
                () ->
                    service.update(
                        actor(manager),
                        t.id(),
                        new SupportTicketService.Update(
                            manager.getId(), "WAITING_CUSTOMER", t.version(), "Clarify", key())))
            .code());
    assertEquals(
        2, service.list(actor(manager), "Find", "NEW", buyer.getId(), null, 0, 1).totalElements());
    assertEquals(
        1,
        service
            .list(actor(manager), "Find", "IN_PROGRESS", buyer.getId(), manager.getId(), 0, 1)
            .totalElements());
    assertThrows(
        ApiException.class,
        () ->
            service.create(
                actor(buyer), new SupportTicketService.Create(null, null, null, " ", "x", key())));
    assertThrows(
        ApiException.class,
        () ->
            service.create(
                actor(buyer), new SupportTicketService.Create(null, null, null, "x", "y", null)));
    assertThrows(
        ApiException.class,
        () ->
            service.reply(
                actor(buyer), t.id(), new SupportTicketService.Reply("Secret", true, key())));
  }

  @Test
  void personalAccessAndPrivateNotesAreProtectedThroughApi() throws Exception {
    var buyer = user("CUSTOMER");
    var other = user("CUSTOMER");
    var manager = user("MANAGER");
    var admin = user("ADMIN");
    var t = service.create(actor(buyer), input(null, null, null)).ticket();
    service.reply(
        actor(manager), t.id(), new SupportTicketService.Reply("INTERNAL_SECRET", true, key()));
    mvc.perform(get("/api/support-tickets")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/support-tickets/" + t.id()).header("Authorization", auth(other)))
        .andExpect(status().isNotFound());
    mvc.perform(
            get("/api/support-tickets?customerId=" + buyer.getId())
                .header("Authorization", auth(other)))
        .andExpect(jsonPath("$.totalElements").value(0));
    String body =
        mvc.perform(get("/api/support-tickets/" + t.id()).header("Authorization", auth(buyer)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.messages.length()").value(0))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertFalse(body.contains("INTERNAL_SECRET"));
    assertFalse(body.contains(manager.getEmail()));
    assertFalse(body.contains("SECRET_HASH"));
    for (User wrong : List.of(buyer, admin))
      mvc.perform(get("/api/manager/support-tickets").header("Authorization", auth(wrong)))
          .andExpect(status().isForbidden());
    mvc.perform(
            get("/api/manager/support-tickets?status=BAD").header("Authorization", auth(manager)))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get("/api/admin/audit-logs?type=SUPPORT_TICKET").header("Authorization", auth(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1));
    mvc.perform(
            post("/api/support-tickets")
                .header("Authorization", auth(buyer))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"customerId\":"
                        + other.getId()
                        + ",\"title\":\"Fake\",\"description\":\"Fake\",\"requestId\":\""
                        + key()
                        + "\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void rollbackRemovesTicketNotificationAndAuditTogether() {
    var tx = new TransactionTemplate(transactions);
    long[] before =
        tx.execute(
            s ->
                new long[] {
                  em.createQuery("select count(t) from SupportTicket t", Long.class)
                      .getSingleResult(),
                  em.createQuery("select count(n) from CustomerNotification n", Long.class)
                      .getSingleResult(),
                  logs.count()
                });
    tx.execute(
        s -> {
          var buyer = user("CUSTOMER");
          var manager = user("MANAGER");
          service.create(actor(manager), input(buyer.getId(), null, manager.getId()));
          s.setRollbackOnly();
          return null;
        });
    tx.execute(
        s -> {
          assertEquals(
              before[0],
              em.createQuery("select count(t) from SupportTicket t", Long.class).getSingleResult());
          assertEquals(
              before[1],
              em.createQuery("select count(n) from CustomerNotification n", Long.class)
                  .getSingleResult());
          assertEquals(before[2], logs.count());
          return null;
        });
  }
}
