package com.htttdn.crm.controller;

import com.htttdn.crm.service.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager")
public class CustomerCareController {
  private final CustomerCareService service;
  private final CareDashboardService dashboard;

  public CustomerCareController(CustomerCareService service, CareDashboardService dashboard) {
    this.service = service;
    this.dashboard = dashboard;
  }

  @GetMapping("/care/dashboard")
  public CareDashboardService.Dashboard dashboard(
      @RequestParam(required = false) java.time.LocalDate from,
      @RequestParam(required = false) java.time.LocalDate to,
      @RequestParam(required = false) Long assigneeId) {
    return dashboard.dashboard(from, to, assigneeId);
  }

  @GetMapping("/care/dormant")
  public CustomerProfileService.Page<CareDashboardService.Customer> dormant(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
    return dashboard.dormant(page, size);
  }

  @GetMapping("/care/tasks")
  public CustomerProfileService.Page<CustomerCareService.Task> tasks(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(required = false) Long customerId,
      @RequestParam(required = false) Long assigneeId,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Boolean overdue,
      @RequestParam(required = false) java.time.LocalDate from,
      @RequestParam(required = false) java.time.LocalDate to,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(required = false) String sourceType,
      @RequestParam(required = false) Long sourceId,
      @RequestParam(required = false) String outcome,
      @RequestParam(required = false) java.time.LocalDate completedFrom,
      @RequestParam(required = false) java.time.LocalDate completedTo) {
    return service.tasks(
        new CustomerCareService.Filters(
            q,
            customerId,
            assigneeId,
            status,
            overdue,
            page,
            size,
            sourceType,
            sourceId,
            outcome,
            completedFrom,
            completedTo),
        from,
        to);
  }

  @GetMapping("/care/sources/{type}/{id}")
  public CustomerCareService.Source source(@PathVariable String type, @PathVariable long id) {
    return service.source(type, id);
  }

  @PostMapping("/care/tasks")
  public ResponseEntity<CustomerCareService.Task> create(
      @RequestHeader("Authorization") String auth,
      @Valid @RequestBody CustomerCareService.CreateTask input) {
    return ResponseEntity.status(201).body(service.create(auth, input));
  }

  @PatchMapping("/care/tasks/{id}")
  public CustomerCareService.Task update(
      @RequestHeader("Authorization") String auth,
      @PathVariable long id,
      @Valid @RequestBody CustomerCareService.UpdateTask input) {
    return service.update(auth, id, input);
  }

  @PostMapping("/care/tasks/{id}/follow-up")
  public ResponseEntity<CustomerCareService.Task> followUp(
      @RequestHeader("Authorization") String auth,
      @PathVariable long id,
      @Valid @RequestBody CustomerCareService.FollowUp input) {
    return ResponseEntity.status(201).body(service.followUp(auth, id, input));
  }

  @GetMapping("/care/staff")
  public CustomerProfileService.Page<CustomerCareService.Staff> staff(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.staff(q, page, size);
  }

  @GetMapping("/users/{id}/care/notes")
  public CustomerProfileService.Page<CustomerCareService.Note> notes(
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.notes(id, page, size);
  }

  @PostMapping("/users/{id}/care/notes")
  public ResponseEntity<CustomerCareService.Note> note(
      @RequestHeader("Authorization") String auth,
      @PathVariable long id,
      @Valid @RequestBody CustomerCareService.NoteInput input) {
    return ResponseEntity.status(201).body(service.addNote(auth, id, input));
  }
}
