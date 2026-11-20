package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.dto.warehouse.WarehouseReportDto;
import com.cnpm.clothingstore.service.WarehouseReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/warehouse/reports")
public class WarehouseReportController {
    private final WarehouseReportService reports;

    public WarehouseReportController(WarehouseReportService reports) {
        this.reports = reports;
    }

    @GetMapping
    public WarehouseReportDto get(@RequestParam String period,
                                  @RequestParam(required = false) Integer year,
                                  @RequestParam(required = false) Integer month,
                                  @RequestParam(required = false) Integer quarter) {
        return reports.report(period, year, month, quarter);
    }
}
