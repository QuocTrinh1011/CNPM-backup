package com.htttdn.crm.controller;

import com.htttdn.crm.service.StockReceiptService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/stock-receipts")
public class StockReceiptController {
    private final StockReceiptService service;
    public StockReceiptController(StockReceiptService service) { this.service = service; }

    @GetMapping
    public StockReceiptService.PageView list(@RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    @GetMapping("/{id}")
    public StockReceiptService.View detail(@PathVariable Long id) { return service.detail(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StockReceiptService.View receive(@Valid @RequestBody StockReceiptService.CreateRequest request) {
        return service.receive(request);
    }
}
