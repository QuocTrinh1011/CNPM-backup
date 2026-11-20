package com.cnpm.clothingstore.dto.hr;

import jakarta.validation.constraints.Size;

public record EmployeeSelfProfileUpdate(
        @Size(max = 40) String phone,
        @Size(max = 150) String emergencyContactName,
        @Size(max = 40) String emergencyContactPhone,
        @Size(max = 80) String emergencyContactRelationship
) {}
