package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.dto.hr.EmployeeReportDto;
import com.cnpm.clothingstore.service.EmployeeReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EmployeeReportController {
    private final EmployeeReportService reports;
    public EmployeeReportController(EmployeeReportService reports) { this.reports = reports; }

    @GetMapping("/api/manager/hr/reports")
    public EmployeeReportDto monthly(@RequestHeader(value = "Authorization", required = false) String authorization,
                                     @RequestParam int year, @RequestParam int month) {
        return reports.monthly(authorization, year, month);
    }
}
