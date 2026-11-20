package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.service.ManagerReportsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/reports")
public class AdminReportsController {
    private final ManagerReportsService reports;

    public AdminReportsController(ManagerReportsService reports) {
        this.reports = reports;
    }

    @GetMapping
    public ManagerReportsService.AdminReportView get(@RequestParam(required = false) Integer year,
                                                      @RequestParam(required = false) Integer quarter,
                                                      @RequestParam(required = false) Integer month) {
        return reports.adminReport(year, quarter, month);
    }

    @GetMapping("/quarterly")
    public ManagerReportsService.AdminQuarterlyReport quarterly(@RequestParam(required = false) Integer year) {
        return reports.adminQuarterlyReport(year);
    }
}
