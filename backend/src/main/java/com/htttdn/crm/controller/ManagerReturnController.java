package com.htttdn.crm.controller;

import com.htttdn.crm.service.ReturnManagementService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/orders")
public class ManagerReturnController {
  private final ReturnManagementService service;
  private final com.htttdn.crm.service.ManagerOrderQuery query;

  public ManagerReturnController(
      ReturnManagementService service, com.htttdn.crm.service.ManagerOrderQuery query) {
    this.service = service;
    this.query = query;
  }

  @PatchMapping("/{id}/return")
  public com.htttdn.crm.service.ManagerOrderQuery.View process(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id,
      @RequestBody ReturnManagementService.Request request) {
    service.process(authorization, id, request);
    return query.detail(id);
  }
}
