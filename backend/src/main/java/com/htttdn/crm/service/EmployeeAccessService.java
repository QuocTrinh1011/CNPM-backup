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
public class EmployeeAccessService {
    private final UserRepository users;
    private final EmployeeProfileRepository profiles;
    private final JwtTokenService jwt;

    public EmployeeAccessService(UserRepository users, EmployeeProfileRepository profiles, JwtTokenService jwt) {
        this.users = users;
        this.profiles = profiles;
        this.jwt = jwt;
    }

    @Transactional(readOnly = true)
    public EmployeeProfile requireEmployee(String authorization) {
        JwtTokenService.Claims claims = jwt.parse(authorization);
        User account = users.findById(claims.userId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên."));
        if (!"EMPLOYEE".equals(claims.role()) || !"EMPLOYEE".equals(account.getRole())
                || account.isLocked() || account.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "EMPLOYEE_SELF_SCOPE_REQUIRED", "Không có quyền truy cập hồ sơ này.");
        }
        return profiles.findById(account.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "EMPLOYEE_NOT_FOUND", "Chưa có hồ sơ nhân viên."));
    }
}
