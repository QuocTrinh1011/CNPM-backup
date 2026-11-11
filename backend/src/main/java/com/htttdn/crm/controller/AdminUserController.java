package com.htttdn.crm.controller;

import com.htttdn.crm.dto.admin.AdminDtos.*;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/users")
public class AdminUserController {
  private final AdminUserService service;
  private final com.htttdn.crm.service.CustomerLifecycleQuery query;

  public AdminUserController(
      AdminUserService service, com.htttdn.crm.service.CustomerLifecycleQuery query) {
    this.service = service;
    this.query = query;
  }

  @PostMapping
  public ResponseEntity<User> create(@Valid @RequestBody AdminUserService.CreateCustomer input) {
    return ResponseEntity.status(201).body(service.create(input));
  }

  @GetMapping
  public com.htttdn.crm.service.CustomerProfileService.Page<
          com.htttdn.crm.service.CustomerLifecycleQuery.Customer>
      list(
          @RequestParam(defaultValue = "") String q,
          @RequestParam(required = false) String stage,
          @RequestParam(required = false) Boolean dormant,
          @RequestParam(required = false) Long minCompletedOrders,
          @RequestParam(required = false) Long maxCompletedOrders,
          @RequestParam(required = false) java.math.BigDecimal minCompletedValue,
          @RequestParam(required = false) java.math.BigDecimal maxCompletedValue,
          @RequestParam(required = false)
              @org.springframework.format.annotation.DateTimeFormat(
                  iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
              java.time.LocalDate lastPurchaseFrom,
          @RequestParam(required = false)
              @org.springframework.format.annotation.DateTimeFormat(
                  iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
              java.time.LocalDate lastPurchaseTo,
          @RequestParam(required = false) java.math.BigDecimal minRating,
          @RequestParam(required = false) java.math.BigDecimal maxRating,
          @RequestParam(required = false) Boolean surveyed,
          @RequestParam(required = false) Long surveyId,
          @RequestParam(defaultValue = "createdAt") String sort,
          @RequestParam(defaultValue = "desc") String direction,
          @RequestParam(defaultValue = "0") int page,
          @RequestParam(defaultValue = "20") int size) {
    return query.list(
        new com.htttdn.crm.service.CustomerLifecycleQuery.Filters(
            q,
            stage,
            dormant,
            minCompletedOrders,
            maxCompletedOrders,
            minCompletedValue,
            maxCompletedValue,
            lastPurchaseFrom,
            lastPurchaseTo,
            sort,
            direction,
            page,
            size,
            minRating,
            maxRating,
            surveyed,
            surveyId));
  }

  @GetMapping("/{id}")
  public User get(@PathVariable Long id) {
    return service.get(id);
  }

  @PutMapping("/{id}")
  public User update(@PathVariable Long id, @Valid @RequestBody UserRequest request) {
    return service.update(id, request);
  }

  @PatchMapping("/{id}/lock")
  public User lock(@PathVariable Long id, @Valid @RequestBody LockRequest request) {
    return service.lock(id, request);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
