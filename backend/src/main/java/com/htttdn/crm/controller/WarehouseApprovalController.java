package com.htttdn.crm.controller;

import com.htttdn.crm.service.WarehouseWorkService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/warehouse")
public class WarehouseApprovalController {
    private final WarehouseWorkService work;

    public WarehouseApprovalController(WarehouseWorkService work) { this.work = work; }

    @GetMapping("/material-requests")
    public WarehouseWorkService.RequestPage materialRequests(@RequestParam(defaultValue = "0") int page,
                                                             @RequestParam(defaultValue = "20") int size) {
        return work.issueRequestQueue(page, size);
    }

    @PatchMapping("/material-requests/{id}/decision")
    public WarehouseWorkService.RequestView decideMaterialRequest(@PathVariable Long id,
            @Valid @RequestBody WarehouseWorkService.DecisionInput input) {
        return work.decideIssueRequest(id, input);
    }

    @GetMapping("/material-returns")
    public WarehouseWorkService.ReturnPage materialReturns(@RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "20") int size) {
        return work.returnQueue(page, size);
    }

    @PatchMapping("/material-returns/{id}/decision")
    public WarehouseWorkService.ReturnView decideMaterialReturn(@PathVariable Long id,
            @Valid @RequestBody WarehouseWorkService.DecisionInput input) {
        return work.decideReturn(id, input);
    }
}
