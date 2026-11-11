package com.htttdn.crm.controller;

import com.htttdn.crm.service.SalesStatisticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/reports/sales-statistics")
public class SalesStatisticsController {
  private final SalesStatisticsService service;

  public SalesStatisticsController(SalesStatisticsService service) {
    this.service = service;
  }

  @GetMapping
  public SalesStatisticsService.View report(
      @RequestParam(required = false) Integer year,
      @RequestParam(defaultValue = "quarter") String groupBy) {
    return service.report(year, groupBy);
  }

  @GetMapping("/staff")
  public java.util.List<SalesStatisticsService.StaffOption> staff() {
    return service.staffOptions();
  }
}
