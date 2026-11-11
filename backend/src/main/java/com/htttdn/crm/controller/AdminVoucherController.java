package com.htttdn.crm.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.htttdn.crm.service.AdminVoucherService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/vouchers")
public class AdminVoucherController {
  private final AdminVoucherService service;

  public AdminVoucherController(AdminVoucherService service) {
    this.service = service;
  }

  @GetMapping
  public Page<AdminVoucherService.View> list(
      @RequestParam(required = false) String search,
      @RequestParam(required = false) String state,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.list(search, state, page, size);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public AdminVoucherService.View create(@RequestBody JsonNode input) {
    return service.createFromJson(input);
  }

  @PatchMapping("/{id}")
  public AdminVoucherService.View update(@PathVariable Long id, @RequestBody JsonNode patch) {
    return service.update(id, patch);
  }
}
