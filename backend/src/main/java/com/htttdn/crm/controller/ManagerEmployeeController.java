package com.htttdn.crm.controller;

import com.htttdn.crm.dto.hr.CreateEmployeeRequest;
import com.htttdn.crm.dto.hr.EmployeeProfileDto;
import com.htttdn.crm.dto.hr.UpdateEmployeeRequest;
import com.htttdn.crm.service.ManagerEmployeeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/employees")
public class ManagerEmployeeController {
    private final ManagerEmployeeService employees;

    public ManagerEmployeeController(ManagerEmployeeService employees) {
        this.employees = employees;
    }

    @GetMapping
    public Page<EmployeeProfileDto> list(@RequestParam(defaultValue = "") String q,
                           @RequestParam(defaultValue = "0") int page,
                           @RequestParam(defaultValue = "20") int size) {
        return employees.list(q, page, size);
    }

    @PostMapping
    public ResponseEntity<EmployeeProfileDto> create(@Valid @RequestBody CreateEmployeeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employees.create(request));
    }

    @PutMapping("/{id}")
    public EmployeeProfileDto update(@PathVariable Long id, @Valid @RequestBody UpdateEmployeeRequest request) {
        return employees.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        employees.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
