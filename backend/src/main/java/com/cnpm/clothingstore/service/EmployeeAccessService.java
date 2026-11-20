package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.EmployeeProfileRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import com.cnpm.clothingstore.security.JwtTokenService;
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
        EmployeeProfile profile = profiles.findById(account.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "EMPLOYEE_NOT_FOUND", "Chưa có hồ sơ nhân viên."));
        if (!"ACTIVE".equals(profile.getEmploymentStatus())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "EMPLOYEE_NOT_ACTIVE", "Nhân viên đã nghỉ việc không thể truy cập chức năng cá nhân.");
        }
        return profile;
    }
}
