package com.cnpm.clothingstore.dto.manager;

public record ManagerEmployeeDto(Long id, String fullName, String email, String phone, boolean locked) {
}
