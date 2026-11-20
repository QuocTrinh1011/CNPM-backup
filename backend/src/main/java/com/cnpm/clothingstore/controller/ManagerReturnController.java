package com.cnpm.clothingstore.controller;
import jakarta.validation.Valid;
import com.cnpm.clothingstore.entity.Order;
import com.cnpm.clothingstore.service.ReturnManagementService;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/manager/orders")
public class ManagerReturnController {
    private final ReturnManagementService service;
    private final com.cnpm.clothingstore.service.ManagerOrderQuery query;
    public ManagerReturnController(ReturnManagementService service,com.cnpm.clothingstore.service.ManagerOrderQuery query){this.service=service;this.query=query;}
    @PatchMapping("/{id}/return") public com.cnpm.clothingstore.service.ManagerOrderQuery.View process(@RequestHeader(value="Authorization",required=false) String authorization,@PathVariable Long id,@RequestBody ReturnManagementService.Request request){service.process(authorization,id,request);return query.detail(id);}
}
