package com.cnpm.clothingstore.dto.hr;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record EmployeeLeaveSubmission(
        @NotBlank @Size(max = 20) String requestType,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        @Size(max = 4000) String employeeNote
) {}
