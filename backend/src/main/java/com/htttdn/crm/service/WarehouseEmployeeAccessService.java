package com.htttdn.crm.service;

import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.EmployeeProfileRepository;
import com.htttdn.crm.repository.UserRepository;
import com.htttdn.crm.security.JwtTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WarehouseEmployeeAccessService {
    private static final String EMPLOYEE_ROLE = "EMPLOYEE";
    private static final String WAREHOUSE_AREA = "WAREHOUSE";

    private final JwtTokenService jwt;
    private final UserRepository users;
    private final EmployeeProfileRepository profiles;

    public WarehouseEmployeeAccessService(JwtTokenService jwt, UserRepository users,
                                          EmployeeProfileRepository profiles) {
        this.jwt = jwt;
        this.users = users;
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public EmployeeProfile requireWarehouseEmployee(String authorization) {
        JwtTokenService.Claims claims = jwt.parse(authorization);
        if (!EMPLOYEE_ROLE.equals(claims.role())) {
            throw forbidden();
        }

        User account = users.findById(claims.userId()).orElseThrow(WarehouseEmployeeAccessService::forbidden);
        if (!EMPLOYEE_ROLE.equals(account.getRole()) || account.isLocked() || account.getDeletedAt() != null) {
            throw forbidden();
        }

        EmployeeProfile profile = profiles.findById(account.getId())
                .orElseThrow(WarehouseEmployeeAccessService::forbidden);
        if (!"ACTIVE".equals(profile.getEmploymentStatus()) || !WAREHOUSE_AREA.equals(profile.getWorkArea())) {
            throw forbidden();
        }
        return profile;
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "WAREHOUSE_EMPLOYEE_REQUIRED",
                "Chức năng kho chỉ dành cho nhân viên đang hoạt động được phân công khu vực kho.");
    }
}
