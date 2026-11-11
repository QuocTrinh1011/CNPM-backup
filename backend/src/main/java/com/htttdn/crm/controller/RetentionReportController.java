package com.htttdn.crm.controller;

import com.htttdn.crm.service.RetentionReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RetentionReportController {
  private final RetentionReportService service;

  public RetentionReportController(RetentionReportService service) {
    this.service = service;
  }

  @GetMapping("/api/manager/reports/retention")
  public RetentionReportService.Report report() {
    return service.report();
  }
}
