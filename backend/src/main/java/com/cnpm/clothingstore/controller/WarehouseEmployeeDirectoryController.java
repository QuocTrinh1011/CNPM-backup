package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.dto.warehouse.WarehouseEmployeeOptionDto;
import com.cnpm.clothingstore.service.ManagerEmployeeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/manager/warehouse/employees")
public class WarehouseEmployeeDirectoryController {
    private final ManagerEmployeeService employees;

    public WarehouseEmployeeDirectoryController(ManagerEmployeeService employees) {
        this.employees = employees;
    }

    @GetMapping
    public List<WarehouseEmployeeOptionDto> listActiveWarehouseEmployees() {
        return employees.listActiveWarehouseEmployeeOptions();
    }
}
