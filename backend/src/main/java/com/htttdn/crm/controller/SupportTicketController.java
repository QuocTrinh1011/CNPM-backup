package com.htttdn.crm.controller;

import com.htttdn.crm.service.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class SupportTicketController {
  private final SupportTicketService service;
  private final AuthService auth;

  public SupportTicketController(SupportTicketService service, AuthService auth) {
    this.service = service;
    this.auth = auth;
  }

  private SupportTicketService.Actor customer(String token) {
    return new SupportTicketService.Actor(auth.requireCustomer(token).getId(), false);
  }

  private SupportTicketService.Actor manager(AuditTrail.Actor actor) {
    return new SupportTicketService.Actor(actor.id(), true);
  }

  @GetMapping("/api/support-tickets")
  public Object list(
      @RequestHeader(value = "Authorization", required = false) String token,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.list(customer(token), q, status, null, null, page, size);
  }

  @GetMapping("/api/support-tickets/{id}")
  public Object detail(
      @RequestHeader(value = "Authorization", required = false) String token,
      @PathVariable long id) {
    return service.detail(customer(token), id);
  }

  @PostMapping("/api/support-tickets")
  public ResponseEntity<?> create(
      @RequestHeader(value = "Authorization", required = false) String token,
      @Valid @RequestBody SupportTicketService.Create input) {
    return ResponseEntity.status(201).body(service.create(customer(token), input));
  }

  @PostMapping("/api/support-tickets/{id}/messages")
  public Object reply(
      @RequestHeader(value = "Authorization", required = false) String token,
      @PathVariable long id,
      @Valid @RequestBody SupportTicketService.Reply input) {
    return service.reply(customer(token), id, input);
  }

  @GetMapping("/api/manager/support-tickets")
  public Object managerList(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor a,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Long customerId,
      @RequestParam(required = false) Long assigneeId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.list(manager(a), q, status, customerId, assigneeId, page, size);
  }

  @GetMapping("/api/manager/support-tickets/{id}")
  public Object managerDetail(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor a, @PathVariable long id) {
    return service.detail(manager(a), id);
  }

  @PostMapping("/api/manager/support-tickets")
  public ResponseEntity<?> managerCreate(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor a,
      @Valid @RequestBody SupportTicketService.Create input) {
    return ResponseEntity.status(201).body(service.create(manager(a), input));
  }

  @PatchMapping("/api/manager/support-tickets/{id}")
  public Object update(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor a,
      @PathVariable long id,
      @Valid @RequestBody SupportTicketService.Update input) {
    return service.update(manager(a), id, input);
  }

  @PostMapping("/api/manager/support-tickets/{id}/messages")
  public Object managerReply(
      @RequestAttribute(AuditTrail.ACTOR_ATTRIBUTE) AuditTrail.Actor a,
      @PathVariable long id,
      @Valid @RequestBody SupportTicketService.Reply input) {
    return service.reply(manager(a), id, input);
  }
}
