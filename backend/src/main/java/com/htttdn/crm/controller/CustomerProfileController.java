package com.htttdn.crm.controller;

import com.htttdn.crm.service.CustomerProfileService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/users/{id}/profile")
public class CustomerProfileController {
  private final CustomerProfileService service;
  private final com.htttdn.crm.service.CustomerActivityService activities;

  public CustomerProfileController(
      CustomerProfileService service, com.htttdn.crm.service.CustomerActivityService activities) {
    this.service = service;
    this.activities = activities;
  }

  @GetMapping("/activities")
  public CustomerProfileService.Page<com.htttdn.crm.service.CustomerActivityService.Event>
      activities(
          @PathVariable long id,
          @RequestParam(defaultValue = "0") int page,
          @RequestParam(defaultValue = "10") int size) {
    return activities.list(id, page, size);
  }

  @GetMapping
  public CustomerProfileService.Profile profile(@PathVariable long id) {
    return service.profile(id);
  }

  @GetMapping("/addresses")
  public CustomerProfileService.Page<CustomerProfileService.Address> addresses(
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.addresses(id, page, size);
  }

  @GetMapping("/orders")
  public CustomerProfileService.Page<CustomerProfileService.OrderRow> orders(
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.orders(id, page, size);
  }

  @GetMapping("/feedback")
  public CustomerProfileService.Page<CustomerProfileService.FeedbackRow> feedback(
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.feedback(id, page, size);
  }

  @GetMapping("/surveys")
  public CustomerProfileService.Page<CustomerProfileService.SurveyRow> surveys(
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.surveys(id, page, size);
  }

  @GetMapping("/vouchers")
  public CustomerProfileService.Page<CustomerProfileService.VoucherRow> vouchers(
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.vouchers(id, page, size);
  }

  @GetMapping("/voucher-usages")
  public CustomerProfileService.Page<CustomerProfileService.UsageRow> voucherUsages(
      @PathVariable long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.voucherUsages(id, page, size);
  }
}
