package com.htttdn.crm.controller;

import com.htttdn.crm.service.AuditLogQuery;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
public class AuditLogController {
  private final AuditLogQuery query;

  public AuditLogController(AuditLogQuery query) {
    this.query = query;
  }

  @GetMapping("/api/admin/audit-logs")
  public AuditLogQuery.Result list(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(required = false) String type,
      @RequestParam(required = false) String action,
      @RequestParam(required = false) Instant from,
      @RequestParam(required = false) Instant to,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return query.list(q, type, action, from, to, page, size);
  }
}
