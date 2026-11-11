package com.htttdn.crm.controller;

import com.htttdn.crm.service.CareOutcomeReportService;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.*;

@RestController
public class CareOutcomeReportController {
  private final CareOutcomeReportService service;

  public CareOutcomeReportController(CareOutcomeReportService service) {
    this.service = service;
  }

  @GetMapping("/api/manager/care/outcomes")
  public CareOutcomeReportService.Report report(
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @RequestParam(required = false) Long assigneeId) {
    return service.report(from, to, assigneeId);
  }
}
