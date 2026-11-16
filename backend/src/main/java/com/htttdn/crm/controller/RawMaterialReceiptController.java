package com.htttdn.crm.controller;

import com.htttdn.crm.service.RawMaterialReceiptService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/raw-material-receipts")
public class RawMaterialReceiptController {
    private final RawMaterialReceiptService receipts;

    public RawMaterialReceiptController(RawMaterialReceiptService receipts) { this.receipts = receipts; }

    @GetMapping
    public RawMaterialReceiptService.PageView list(@RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return receipts.list(page, size);
    }

    @GetMapping("/{id}")
    public RawMaterialReceiptService.View detail(@PathVariable Long id) { return receipts.detail(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RawMaterialReceiptService.View receive(
            @Valid @RequestBody RawMaterialReceiptService.CreateRequest request) {
        return receipts.receive(request);
    }
}
