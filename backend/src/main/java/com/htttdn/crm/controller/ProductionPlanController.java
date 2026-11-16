package com.htttdn.crm.controller;

import com.htttdn.crm.service.ProductionPlanService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/production-plans")
public class ProductionPlanController {
    private final ProductionPlanService plans;

    public ProductionPlanController(ProductionPlanService plans) { this.plans = plans; }

    @GetMapping
    public ProductionPlanService.PageView list(@RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size) {
        return plans.list(page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductionPlanService.View create(@Valid @RequestBody ProductionPlanService.CreateRequest request) {
        return plans.create(request);
    }

    @GetMapping("/{id}")
    public ProductionPlanService.View detail(@PathVariable Long id) { return plans.detail(id); }

    @PatchMapping("/{id}/cancel")
    public ProductionPlanService.View cancel(@PathVariable Long id) { return plans.cancel(id); }
}
