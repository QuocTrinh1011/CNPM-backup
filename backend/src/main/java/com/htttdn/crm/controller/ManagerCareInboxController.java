package com.htttdn.crm.controller;

import com.htttdn.crm.service.*;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager")
public class ManagerCareInboxController {
  private final CustomerCareService care;
  private final ManagerCareInbox inbox;

  public ManagerCareInboxController(CustomerCareService care, ManagerCareInbox inbox) {
    this.care = care;
    this.inbox = inbox;
  }

  @GetMapping("/care/my-tasks")
  public CustomerProfileService.Page<CustomerCareService.Task> tasks(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor actor,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "OPEN") String group,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return care.personalTasks(actor.id(), q, group, page, size, Instant.now());
  }

  @GetMapping("/care/my-tasks/summary")
  public ManagerCareInbox.Summary summary(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor actor) {
    return inbox.summary(actor.id(), Instant.now());
  }

  @GetMapping("/care/tasks/{id}")
  public CustomerCareService.Task detail(@PathVariable long id) {
    return care.detail(id);
  }

  @GetMapping("/notifications/summary")
  public Map<String, Long> unread(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor actor) {
    return Map.of("unreadCount", inbox.unread(actor.id(), Instant.now()));
  }

  @GetMapping("/notifications")
  public ManagerCareInbox.Notifications notifications(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor actor,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return inbox.notifications(actor.id(), page, size, Instant.now());
  }

  @PatchMapping("/notifications/{id}/read")
  public ResponseEntity<Void> read(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor actor, @PathVariable long id) {
    inbox.read(actor.id(), id, Instant.now());
    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/notifications/read-all")
  public ResponseEntity<Void> readAll(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor actor) {
    inbox.readAll(actor.id(), Instant.now());
    return ResponseEntity.noContent().build();
  }
}
