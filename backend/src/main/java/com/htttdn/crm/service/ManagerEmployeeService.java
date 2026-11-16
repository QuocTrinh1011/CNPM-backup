package com.htttdn.crm.service;

import com.htttdn.crm.dto.hr.CreateEmployeeRequest;
import com.htttdn.crm.dto.hr.EmployeeProfileDto;
import com.htttdn.crm.dto.hr.EmployeeSelfProfileUpdate;
import com.htttdn.crm.dto.hr.UpdateEmployeeRequest;
import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.EmployeeProfileRepository;
import com.htttdn.crm.repository.RefreshTokenRepository;
import com.htttdn.crm.repository.UserRepository;
import com.htttdn.crm.security.JwtTokenService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class ManagerEmployeeService {
    private static final Set<String> PERMISSION_PROFILES = Set.of("STAFF", "TEAM_LEAD");
    private static final Set<String> EMPLOYMENT_STATUSES = Set.of("ACTIVE", "RESIGNED", "TERMINATED");

    private final UserRepository users;
    private final EmployeeProfileRepository profiles;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final JwtTokenService jwt;
    private final AuditTrail audit;

    public ManagerEmployeeService(UserRepository users, EmployeeProfileRepository profiles,
                                  RefreshTokenRepository refreshTokens, PasswordEncoder encoder,
                                  JwtTokenService jwt, AuditTrail audit) {
        this.users = users;
        this.profiles = profiles;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.jwt = jwt;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Page<EmployeeProfileDto> list(String q, int page, int size) {
        String query = q == null ? "" : q.trim();
        int pageNumber = Math.max(0, page);
        int pageSize = Math.max(1, Math.min(100, size));
        return profiles.searchDirectory(query,
                        PageRequest.of(pageNumber, pageSize, Sort.by("employeeId").descending()))
                .map(EmployeeProfileDto::from);
    }

    @Transactional
    public EmployeeProfileDto create(CreateEmployeeRequest input) {
        String email = normalizeEmail(input.email());
        String code = normalizeCode(input.employeeCode());
        ensureEmailAvailable(email, null);
        ensureEmployeeCodeAvailable(code, null);
        validatePassword(input.temporaryPassword());
        String permissionProfile = normalizePermissionProfile(input.permissionProfile());

        User account = new User();
        account.setEmail(email);
        account.setFullName(input.fullName().trim());
        account.setPhone(normalizeNullable(input.phone()));
        account.setPasswordHash(encoder.encode(input.temporaryPassword()));
        account.setRole("EMPLOYEE");
        account.setLocked(false);
        account = users.saveAndFlush(account);

        EmployeeProfile profile = new EmployeeProfile();
        profile.setEmployeeId(account.getId());
        profile.setAccount(account);
        profile.setEmployeeCode(code);
        profile.setEducationLevel(normalizeNullable(input.educationLevel()));
        profile.setJobTitle(input.jobTitle().trim());
        profile.setPermissionProfile(permissionProfile);
        profile.setEmploymentStatus("ACTIVE");
        profile.setHireDate(input.hireDate());
        profile.setMonthlyBaseSalary(input.monthlyBaseSalary());
        profile.setInsuranceSalaryBase(input.insuranceSalaryBase());
        profile.setEmergencyContactName(normalizeNullable(input.emergencyContactName()));
        profile.setEmergencyContactPhone(normalizeNullable(input.emergencyContactPhone()));
        profile.setEmergencyContactRelationship(normalizeNullable(input.emergencyContactRelationship()));
        if (input.reportsToEmployeeId() != null) {
            setManager(profile, input.reportsToEmployeeId());
        }
        profiles.saveAndFlush(profile);
        audit.record("CREATE", "EMPLOYEE", profile.getEmployeeId(), Map.of(), AuditTrail.snapshot(profile));
        return EmployeeProfileDto.from(profile);
    }

    @Transactional
    public EmployeeProfileDto update(Long employeeId, UpdateEmployeeRequest input) {
        User account = activeEmployee(employeeId);
        EmployeeProfile profile = profile(employeeId);
        var before = AuditTrail.snapshot(profile);

        if (input.email() != null) {
            String email = normalizeEmail(input.email());
            ensureEmailAvailable(email, employeeId);
            account.setEmail(email);
        }
        if (input.fullName() != null) account.setFullName(input.fullName().trim());
        if (input.phone() != null) account.setPhone(normalizeNullable(input.phone()));
        if (input.employeeCode() != null) {
            String code = normalizeCode(input.employeeCode());
            ensureEmployeeCodeAvailable(code, employeeId);
            profile.setEmployeeCode(code);
        }
        if (input.educationLevel() != null) profile.setEducationLevel(normalizeNullable(input.educationLevel()));
        if (input.jobTitle() != null) profile.setJobTitle(input.jobTitle().trim());
        if (input.permissionProfile() != null) {
            String permissionProfile = normalizePermissionProfile(input.permissionProfile());
            if ("TEAM_LEAD".equals(profile.getPermissionProfile()) && "STAFF".equals(permissionProfile)
                    && profiles.existsByReportsToEmployeeId(employeeId)) {
                throw bad("TEAM_LEAD_HAS_REPORTS", "Hãy chuyển nhân viên thuộc nhóm sang trưởng nhóm khác trước.");
            }
            profile.setPermissionProfile(permissionProfile);
        }
        if (input.employmentStatus() != null) {
            String status = input.employmentStatus().trim().toUpperCase(Locale.ROOT);
            if (!EMPLOYMENT_STATUSES.contains(status)) {
                throw bad("INVALID_EMPLOYMENT_STATUS", "Tình trạng nhân sự không hợp lệ.");
            }
            profile.setEmploymentStatus(status);
            if ("RESIGNED".equals(status) && profile.getResignationDate() == null) {
                profile.setResignationDate(input.resignationDate() == null ? LocalDate.now() : input.resignationDate());
            }
        }
        if (input.hireDate() != null) profile.setHireDate(input.hireDate());
        if (input.resignationDate() != null) profile.setResignationDate(input.resignationDate());
        if (input.monthlyBaseSalary() != null) profile.setMonthlyBaseSalary(input.monthlyBaseSalary());
        if (input.insuranceSalaryBase() != null) profile.setInsuranceSalaryBase(input.insuranceSalaryBase());
        if (input.reportsToEmployeeId() != null) setManager(profile, input.reportsToEmployeeId());
        if (input.emergencyContactName() != null) profile.setEmergencyContactName(normalizeNullable(input.emergencyContactName()));
        if (input.emergencyContactPhone() != null) profile.setEmergencyContactPhone(normalizeNullable(input.emergencyContactPhone()));
        if (input.emergencyContactRelationship() != null) profile.setEmergencyContactRelationship(normalizeNullable(input.emergencyContactRelationship()));

        if (profile.getResignationDate() != null && profile.getResignationDate().isBefore(profile.getHireDate())) {
            throw bad("INVALID_RESIGNATION_DATE", "Ngày nghỉ việc không được trước ngày nhận việc.");
        }
        account = users.save(account);
        profile.setAccount(account);
        profile.touch();
        profiles.saveAndFlush(profile);
        audit.record("UPDATE", "EMPLOYEE", employeeId, before, AuditTrail.snapshot(profile));
        return EmployeeProfileDto.from(profile);
    }

    @Transactional
    public void deactivate(Long employeeId) {
        User account = activeEmployee(employeeId);
        EmployeeProfile profile = profile(employeeId);
        var before = AuditTrail.snapshot(profile);
        Instant now = Instant.now();
        account.setDeletedAt(now);
        account.setLocked(true);
        profile.setEmploymentStatus("TERMINATED");
        if (profile.getResignationDate() == null) profile.setResignationDate(LocalDate.now());
        profile.touch();
        users.save(account);
        profiles.saveAndFlush(profile);
        refreshTokens.revokeByUserId(employeeId);
        audit.record("DEACTIVATE", "EMPLOYEE", employeeId, before, AuditTrail.snapshot(profile));
    }

    @Transactional(readOnly = true)
    public EmployeeProfileDto selfProfile(String authorization) {
        User account = authenticatedEmployee(authorization);
        return EmployeeProfileDto.from(profile(account.getId()));
    }

    @Transactional
    public EmployeeProfileDto updateSelfProfile(String authorization, EmployeeSelfProfileUpdate input) {
        User account = authenticatedEmployee(authorization);
        EmployeeProfile profile = profile(account.getId());
        boolean contactChanged = input.phone() != null || input.emergencyContactName() != null
                || input.emergencyContactPhone() != null || input.emergencyContactRelationship() != null;
        if (input.phone() != null) account.setPhone(normalizeNullable(input.phone()));
        if (input.emergencyContactName() != null) profile.setEmergencyContactName(normalizeNullable(input.emergencyContactName()));
        if (input.emergencyContactPhone() != null) profile.setEmergencyContactPhone(normalizeNullable(input.emergencyContactPhone()));
        if (input.emergencyContactRelationship() != null) profile.setEmergencyContactRelationship(normalizeNullable(input.emergencyContactRelationship()));
        users.save(account);
        profile.setAccount(account);
        profile.touch();
        profiles.saveAndFlush(profile);
        if (contactChanged) {
            audit.record("UPDATE_CONTACT", "EMPLOYEE", account.getId(),
                    Map.of("contactUpdated", false), Map.of("contactUpdated", true));
        }
        return EmployeeProfileDto.from(profile);
    }

    private User authenticatedEmployee(String authorization) {
        JwtTokenService.Claims claims = jwt.parse(authorization);
        User account = users.findById(claims.userId()).orElseThrow(() -> notFound("Không tìm thấy nhân viên."));
        if (!"EMPLOYEE".equals(claims.role()) || !"EMPLOYEE".equals(account.getRole())
                || account.isLocked() || account.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "EMPLOYEE_SELF_SCOPE_REQUIRED", "Không có quyền truy cập hồ sơ này.");
        }
        return account;
    }

    private User activeEmployee(Long employeeId) {
        User account = users.findById(employeeId).orElseThrow(() -> notFound("Không tìm thấy nhân viên."));
        if (!"EMPLOYEE".equals(account.getRole()) || account.getDeletedAt() != null) {
            throw notFound("Không tìm thấy nhân viên đang hoạt động.");
        }
        return account;
    }

    private EmployeeProfile profile(Long employeeId) {
        return profiles.findById(employeeId).orElseThrow(() -> notFound("Chưa có hồ sơ nhân viên."));
    }

    private void setManager(EmployeeProfile employee, Long managerId) {
        if (managerId.equals(employee.getEmployeeId())) {
            throw bad("INVALID_TEAM_LEAD", "Nhân viên không thể báo cáo cho chính mình.");
        }
        EmployeeProfile manager = profiles.findById(managerId).orElseThrow(() -> bad("INVALID_TEAM_LEAD", "Không tìm thấy trưởng nhóm."));
        User managerAccount = users.findById(managerId).orElseThrow(() -> bad("INVALID_TEAM_LEAD", "Không tìm thấy trưởng nhóm."));
        if (!"EMPLOYEE".equals(managerAccount.getRole()) || managerAccount.isLocked() || managerAccount.getDeletedAt() != null
                || !"ACTIVE".equals(manager.getEmploymentStatus()) || !"TEAM_LEAD".equals(manager.getPermissionProfile())) {
            throw bad("INVALID_TEAM_LEAD", "Chỉ nhân viên đang làm việc có hồ sơ trưởng nhóm mới nhận nhân viên báo cáo.");
        }
        Long cursor = manager.getEmployeeId();
        while (cursor != null) {
            if (cursor.equals(employee.getEmployeeId())) {
                throw bad("TEAM_REPORT_CYCLE", "Không thể tạo vòng lặp trong sơ đồ báo cáo.");
            }
            cursor = profiles.findById(cursor).map(EmployeeProfile::getReportsToEmployeeId).orElse(null);
        }
        employee.setReportsToEmployeeId(managerId);
    }

    private void ensureEmailAvailable(String email, Long currentId) {
        users.findByEmailIgnoreCase(email)
                .filter(other -> !other.getId().equals(currentId))
                .ifPresent(other -> { throw new ApiException(HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email đã tồn tại."); });
    }

    private void ensureEmployeeCodeAvailable(String code, Long currentId) {
        profiles.findByEmployeeCodeIgnoreCase(code)
                .filter(other -> !other.getEmployeeId().equals(currentId))
                .ifPresent(other -> { throw new ApiException(HttpStatus.CONFLICT, "EMPLOYEE_CODE_EXISTS", "Mã nhân viên đã tồn tại."); });
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizePermissionProfile(String permissionProfile) {
        String normalized = permissionProfile == null || permissionProfile.isBlank()
                ? "STAFF" : permissionProfile.trim().toUpperCase(Locale.ROOT);
        if (!PERMISSION_PROFILES.contains(normalized)) {
            throw bad("INVALID_EMPLOYEE_PROFILE", "Hồ sơ quyền nhân viên không hợp lệ.");
        }
        return normalized;
    }

    private static String normalizeNullable(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw bad("INVALID_PASSWORD", "Mật khẩu tạm thời từ 8 ký tự, tối đa 72 byte.");
        }
    }

    private static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "EMPLOYEE_NOT_FOUND", message);
    }

    private static ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
