package com.htttdn.crm.dto.hr;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmployeeLeaveDecision(
        @NotBlank @Size(max = 20) String decision,
        @Size(max = 4000) String reviewerNote
) {}
