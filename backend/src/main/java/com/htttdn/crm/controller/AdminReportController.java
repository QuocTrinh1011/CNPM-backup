package com.htttdn.crm.controller;

import com.htttdn.crm.service.AdminReportService;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/reports")
public class AdminReportController {
  private final AdminReportService service;

  public AdminReportController(AdminReportService service) {
    this.service = service;
  }

  @GetMapping("/revenue")
  public Map<String, Object> revenue() {
    return service.revenue();
  }

  @GetMapping("/users")
  public Map<String, Object> users() {
    return service.users();
  }

  @GetMapping("/surveys/stats")
  public Map<String, Object> surveyStats() {
    return service.surveyStats();
  }
}
