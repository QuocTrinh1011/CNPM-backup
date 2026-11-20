package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.dto.hr.EmployeeLeaveDecision;
import com.cnpm.clothingstore.dto.hr.EmployeeLeaveDto;
import com.cnpm.clothingstore.dto.hr.EmployeeLeaveSubmission;
import com.cnpm.clothingstore.service.EmployeeLeaveService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EmployeeLeaveController {
    private final EmployeeLeaveService leaves;

    public EmployeeLeaveController(EmployeeLeaveService leaves) { this.leaves = leaves; }

    @GetMapping("/api/manager/me/leave-requests")
    public Page<EmployeeLeaveDto> listMine(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return leaves.listMine(authorization, page, size);
    }

    @PostMapping("/api/manager/me/leave-requests")
    public ResponseEntity<EmployeeLeaveDto> submit(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody EmployeeLeaveSubmission request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(leaves.submit(authorization, request));
    }

    @PatchMapping("/api/manager/me/leave-requests/{id}/withdraw")
    public EmployeeLeaveDto withdraw(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        return leaves.withdraw(authorization, id);
    }

    @GetMapping("/api/manager/hr/leave-requests")
    public Page<EmployeeLeaveDto> listForHr(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long employeeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return leaves.listForHr(status, employeeId, page, size);
    }

    @PatchMapping("/api/manager/hr/leave-requests/{id}/decision")
    public EmployeeLeaveDto decide(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @Valid @RequestBody EmployeeLeaveDecision decision) {
        return leaves.decide(authorization, id, decision);
    }
}
