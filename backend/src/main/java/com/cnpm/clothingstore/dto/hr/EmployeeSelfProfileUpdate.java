package com.cnpm.clothingstore.dto.hr;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

public record EmployeeSelfProfileUpdate(
        @Size(max = 150) @Pattern(regexp = "(?s).*\\S.*", message = "Họ tên không được để trống.") String fullName,
        @Size(max = 40) String phone,
        @Size(max = 150) String emergencyContactName,
        @Size(max = 40) String emergencyContactPhone,
        @Size(max = 80) String emergencyContactRelationship
) {}
