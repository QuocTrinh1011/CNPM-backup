package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.RefreshToken;
import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.EmployeeProfileRepository;
import com.cnpm.clothingstore.repository.RefreshTokenRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import com.cnpm.clothingstore.security.JwtTokenService;
import com.cnpm.clothingstore.security.ManagerRoleAccessPolicy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.ResponseCookie;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class ManagerAuthService {
    private final UserRepository users; private final EmployeeProfileRepository employeeProfiles;
    private final RefreshTokenRepository refreshTokens; private final PasswordEncoder encoder; private final JwtTokenService jwt;
    @Value("${app.auth.refresh-days:30}") private long refreshDays;
    @Value("${app.auth.secure-cookie:false}") private boolean secureCookie;
    public ManagerAuthService(UserRepository users, EmployeeProfileRepository employeeProfiles, RefreshTokenRepository refreshTokens, PasswordEncoder encoder, JwtTokenService jwt) { this.users = users; this.employeeProfiles = employeeProfiles; this.refreshTokens = refreshTokens; this.encoder = encoder; this.jwt = jwt; }

    @Transactional public Session login(String email, String password) {
        User user = users.findByEmailIgnoreCase(email == null ? "" : email.trim().toLowerCase(Locale.ROOT)).orElse(null);
        if (user == null || !ManagerRoleAccessPolicy.isManagerPortalRole(user.getRole()) || !employeeProfileActive(user)
                || user.getPasswordHash() == null || !encoder.matches(password == null ? "" : password, user.getPasswordHash())) throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Thông tin đăng nhập manager không đúng.");
        if ((user.isLocked() || user.getDeletedAt()!=null)) throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED", "Tài khoản manager đang bị khóa.");
        return issue(user, UUID.randomUUID().toString());
    }

    @Transactional(noRollbackFor = ApiException.class) public Session refresh(String raw) {
        RefreshToken token = refreshTokens.findForUpdate(AuthService.hash(raw == null ? "" : raw)).orElseThrow(() -> invalidRefresh());
        if (!ManagerRoleAccessPolicy.isManagerPortalRole(token.getAudience())) throw invalidRefresh();
        if ("ROTATED".equals(token.getStatus())) { refreshTokens.revokeFamily(token.getFamilyId(), "REUSE_DETECTED"); throw invalidRefresh(); }
        if (!"ACTIVE".equals(token.getStatus()) || token.getExpiresAt().isBefore(Instant.now())) throw invalidRefresh();
        User user = token.getUser();
        if (!ManagerRoleAccessPolicy.isManagerPortalRole(user.getRole()) || user.isLocked() || user.getDeletedAt()!=null) throw invalidRefresh();
        if (!employeeProfileActive(user)) { refreshTokens.revokeFamily(token.getFamilyId(), "EMPLOYEE_NOT_ACTIVE"); throw invalidRefresh(); }
        if (!token.getAudience().equals(user.getRole())) {
            token.setStatus("REVOKED"); token.setRevokeReason("ROLE_CHANGED"); token.setRevokedAt(Instant.now()); refreshTokens.save(token);
            refreshTokens.revokeFamily(token.getFamilyId(), "ROLE_CHANGED");
            throw invalidRefresh();
        }
        token.setStatus("ROTATED"); token.setRevokeReason("ROTATED"); token.setRevokedAt(Instant.now()); refreshTokens.save(token);
        return issue(user, token.getFamilyId());
    }

    @Transactional public void logout(String raw) { if (raw == null || raw.isBlank()) return; refreshTokens.findForUpdate(AuthService.hash(raw)).filter(t -> ManagerRoleAccessPolicy.isManagerPortalRole(t.getAudience())).ifPresent(t -> { if ("ACTIVE".equals(t.getStatus())) { t.setStatus("REVOKED"); t.setRevokeReason("LOGOUT"); t.setRevokedAt(Instant.now()); refreshTokens.save(t); } }); }
    @Transactional public void changePassword(String authorization, String currentPassword, String newPassword) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Vui lòng đăng nhập.");
        }

        JwtTokenService.Claims claims = jwt.parse(authorization);
        if (!ManagerRoleAccessPolicy.isManagerPortalRole(claims.role())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "MANAGER_REQUIRED", "Yêu cầu quyền nhân viên quản lý.");
        }

        User user = users.findById(claims.userId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Không tìm thấy người dùng."));
        if (!claims.role().equals(user.getRole()) || !ManagerRoleAccessPolicy.isManagerPortalRole(user.getRole()) || user.getDeletedAt() != null
                || !employeeProfileActive(user)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Phiên làm việc không hợp lệ.");
        }
        if (user.isLocked()) {
            throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED", "Tài khoản đang bị khóa.");
        }
        if (!encoder.matches(currentPassword == null ? "" : currentPassword, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_INVALID", "Mật khẩu hiện tại không đúng.");
        }
        if (newPassword == null || newPassword.length() < 8 || newPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", "Mật khẩu mới từ 8 ký tự, tối đa 72 byte.");
        }

        user.setPasswordHash(encoder.encode(newPassword));
        users.save(user);
        refreshTokens.revokeByUserId(user.getId());
    }
    public ResponseCookie cookie(String raw) { return ResponseCookie.from("managerRefreshToken", raw).httpOnly(true).secure(secureCookie).sameSite("Lax").path("/api/manager/auth").maxAge(Duration.ofDays(refreshDays)).build(); }
    public ResponseCookie clearCookie() { return ResponseCookie.from("managerRefreshToken", "").httpOnly(true).secure(secureCookie).sameSite("Lax").path("/api/manager/auth").maxAge(Duration.ZERO).build(); }
    private Session issue(User user, String family) { String raw = UUID.randomUUID() + "." + UUID.randomUUID(); RefreshToken token = new RefreshToken(); token.setUser(user); token.setAudience(user.getRole()); token.setFamilyId(family); token.setTokenHash(AuthService.hash(raw)); token.setExpiresAt(Instant.now().plus(Duration.ofDays(refreshDays))); refreshTokens.save(token); return new Session(jwt.issue(user.getId(), user.getRole()), raw, user); }
    private boolean employeeProfileActive(User user) {
        if (!"EMPLOYEE".equals(user.getRole())) return true;
        return employeeProfiles.findById(user.getId())
                .map(profile -> "ACTIVE".equals(profile.getEmploymentStatus()))
                .orElse(false);
    }
    private ApiException invalidRefresh() { return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Phiên manager không hợp lệ hoặc đã hết hạn."); }
    public record Session(String accessToken, String refreshToken, User user) {}
}
