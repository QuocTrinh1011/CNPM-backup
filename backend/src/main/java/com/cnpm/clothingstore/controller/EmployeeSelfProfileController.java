package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.dto.hr.EmployeeProfileDto;
import com.cnpm.clothingstore.dto.hr.EmployeeSelfProfileUpdate;
import com.cnpm.clothingstore.service.ManagerEmployeeService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/me/profile")
public class EmployeeSelfProfileController {
    private final ManagerEmployeeService employees;

    public EmployeeSelfProfileController(ManagerEmployeeService employees) {
        this.employees = employees;
    }

    @GetMapping
    public EmployeeProfileDto profile(@RequestHeader("Authorization") String authorization) {
        return employees.selfProfile(authorization);
    }

    @PutMapping
    public EmployeeProfileDto update(@RequestHeader("Authorization") String authorization,
                                     @Valid @RequestBody EmployeeSelfProfileUpdate request) {
        return employees.updateSelfProfile(authorization, request);
    }
}
