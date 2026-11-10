package com.htttdn.crm.controller;

import com.htttdn.crm.service.InventoryExpenseReportService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/reports/inventory-expenses")
public class InventoryExpenseReportController {
    private final InventoryExpenseReportService service;
    public InventoryExpenseReportController(InventoryExpenseReportService service) { this.service = service; }

    @GetMapping
    public InventoryExpenseReportService.View byYear(@RequestParam(required = false) Integer year) {
        return service.byYear(year);
    }
}
