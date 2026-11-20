package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.dto.admin.AdminDtos.LockRequest;
import com.cnpm.clothingstore.dto.admin.AdminDtos.AdminCustomerUpdateRequest;
import com.cnpm.clothingstore.dto.admin.AdminDtos.AdminCustomerView;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/customers")
public class AdminCustomerController {
    private final AdminUserService customers;

    public AdminCustomerController(AdminUserService customers) {
        this.customers = customers;
    }

    @PutMapping("/{id}")
    public AdminCustomerView update(@PathVariable Long id, @Valid @RequestBody AdminCustomerUpdateRequest request) {
        return view(customers.updateAdminCustomer(id, request));
    }

    @PatchMapping("/{id}/lock")
    public AdminCustomerView lock(@PathVariable Long id, @Valid @RequestBody LockRequest request) {
        return view(customers.lock(id, request));
    }

    private AdminCustomerView view(User user) {
        return new AdminCustomerView(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(),
                user.getPreferences(), user.getRole(), user.isLocked(), user.getLockReason());
    }
}
