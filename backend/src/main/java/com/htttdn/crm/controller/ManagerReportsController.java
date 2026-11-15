package com.htttdn.crm.controller;

import com.htttdn.crm.service.ManagerReportsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/reports")
public class ManagerReportsController {
    private final ManagerReportsService reports;

    public ManagerReportsController(ManagerReportsService reports) {
        this.reports = reports;
    }

    @GetMapping
    public ManagerReportsService.ReportView get(@RequestParam(required = false) Integer year,
                                                 @RequestParam(required = false) Integer month) {
        return reports.report(year, month);
    }
}
