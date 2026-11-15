package com.htttdn.crm.controller;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.service.ManagerEmployeeService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/employees")
public class ManagerEmployeeController {
    private final ManagerEmployeeService employees;

    public ManagerEmployeeController(ManagerEmployeeService employees) {
        this.employees = employees;
    }

    @GetMapping
    public Page<User> list(@RequestParam(defaultValue = "") String q,
                           @RequestParam(defaultValue = "0") int page,
                           @RequestParam(defaultValue = "20") int size) {
        return employees.list(q, page, size);
    }
}
