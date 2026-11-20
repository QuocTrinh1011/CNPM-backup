package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.service.WarehouseEmployeeAccessService;
import com.cnpm.clothingstore.service.WarehouseWorkService;
import com.cnpm.clothingstore.service.FinishedGoodsTransferService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/warehouse/me")
public class WarehouseEmployeeController {
    private final WarehouseEmployeeAccessService access;
    private final WarehouseWorkService work;
    private final FinishedGoodsTransferService finishedGoods;

    public WarehouseEmployeeController(WarehouseEmployeeAccessService access, WarehouseWorkService work,
                                       FinishedGoodsTransferService finishedGoods) {
        this.access = access;
        this.work = work;
        this.finishedGoods = finishedGoods;
    }

    @GetMapping("/plans")
    public WarehouseWorkService.PlanPage plans(@RequestHeader("Authorization") String authorization,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size) {
        return work.myPlans(access.requireWarehouseEmployee(authorization).getEmployeeId(), page, size);
    }

    @GetMapping("/material-requests")
    public WarehouseWorkService.RequestPage materialRequests(@RequestHeader("Authorization") String authorization,
                                                             @RequestParam(defaultValue = "0") int page,
                                                             @RequestParam(defaultValue = "20") int size) {
        return work.myIssueRequests(access.requireWarehouseEmployee(authorization).getEmployeeId(), page, size);
    }

    @PostMapping("/material-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public WarehouseWorkService.RequestView createMaterialRequest(
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody WarehouseWorkService.IssueRequestInput input) {
        return work.createIssueRequest(access.requireWarehouseEmployee(authorization), input);
    }

    @PostMapping("/plans/{planId}/production-runs")
    @ResponseStatus(HttpStatus.CREATED)
    public WarehouseWorkService.RunView productionRun(@RequestHeader("Authorization") String authorization,
                                                      @PathVariable Long planId,
                                                      @Valid @RequestBody WarehouseWorkService.ProductionInput input) {
        return work.produce(access.requireWarehouseEmployee(authorization), planId, input);
    }

    @GetMapping("/material-returns")
    public WarehouseWorkService.ReturnPage materialReturns(@RequestHeader("Authorization") String authorization,
                                                           @RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "20") int size) {
        return work.myReturns(access.requireWarehouseEmployee(authorization).getEmployeeId(), page, size);
    }

    @PostMapping("/plans/{planId}/material-returns")
    @ResponseStatus(HttpStatus.CREATED)
    public WarehouseWorkService.ReturnView createMaterialReturn(
            @RequestHeader("Authorization") String authorization, @PathVariable Long planId,
            @Valid @RequestBody WarehouseWorkService.ReturnRequestInput input) {
        return work.createReturn(access.requireWarehouseEmployee(authorization), planId, input);
    }

    @GetMapping("/finished-goods-requests")
    public FinishedGoodsTransferService.RequestPage finishedGoodsRequests(
            @RequestHeader("Authorization") String authorization,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return finishedGoods.myRequests(access.requireWarehouseEmployee(authorization).getEmployeeId(), page, size);
    }

    @PostMapping("/finished-goods-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public FinishedGoodsTransferService.RequestView createFinishedGoodsRequest(
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody FinishedGoodsTransferService.RequestInput input) {
        return finishedGoods.createRequest(access.requireWarehouseEmployee(authorization), input);
    }
}
