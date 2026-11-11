package com.htttdn.crm.service;

import com.htttdn.crm.entity.RefreshToken;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.RefreshTokenRepository;
import com.htttdn.crm.repository.UserRepository;
import com.htttdn.crm.security.JwtTokenService;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManagerAuthService {
  private final UserRepository users;
  private final RefreshTokenRepository refreshTokens;
  private final PasswordEncoder encoder;
  private final JwtTokenService jwt;

  @Value("${app.auth.refresh-days:30}")
  private long refreshDays;

  @Value("${app.auth.secure-cookie:false}")
  private boolean secureCookie;

  public ManagerAuthService(
      UserRepository users,
      RefreshTokenRepository refreshTokens,
      PasswordEncoder encoder,
      JwtTokenService jwt) {
    this.users = users;
    this.refreshTokens = refreshTokens;
    this.encoder = encoder;
    this.jwt = jwt;
  }

  @Transactional
  public Session login(String email, String password) {
    User user =
        users
            .findByEmailIgnoreCase(email == null ? "" : email.trim().toLowerCase(Locale.ROOT))
            .orElse(null);
    if (user == null
        || !"MANAGER".equals(user.getRole())
        || user.getPasswordHash() == null
        || !encoder.matches(password == null ? "" : password, user.getPasswordHash()))
      throw new ApiException(
          HttpStatus.UNAUTHORIZED,
          "INVALID_CREDENTIALS",
          "Thông tin đăng nhập manager không đúng.");
    if ((user.isLocked() || user.getDeletedAt() != null))
      throw new ApiException(
          HttpStatus.LOCKED, "ACCOUNT_LOCKED", "Tài khoản manager đang bị khóa.");
    return issue(user, UUID.randomUUID().toString());
  }

  @Transactional(noRollbackFor = ApiException.class)
  public Session refresh(String raw) {
    RefreshToken token =
        refreshTokens
            .findForUpdate(AuthService.hash(raw == null ? "" : raw))
            .orElseThrow(() -> invalidRefresh());
    if (!"MANAGER".equals(token.getAudience())) throw invalidRefresh();
    if ("ROTATED".equals(token.getStatus())) {
      refreshTokens.revokeFamily(token.getFamilyId(), "REUSE_DETECTED");
      throw invalidRefresh();
    }
    if (!"ACTIVE".equals(token.getStatus()) || token.getExpiresAt().isBefore(Instant.now()))
      throw invalidRefresh();
    token.setStatus("ROTATED");
    token.setRevokeReason("ROTATED");
    token.setRevokedAt(Instant.now());
    refreshTokens.save(token);
    User user = token.getUser();
    if (!"MANAGER".equals(user.getRole()) || (user.isLocked() || user.getDeletedAt() != null))
      throw invalidRefresh();
    return issue(user, token.getFamilyId());
  }

  @Transactional
  public void logout(String raw) {
    if (raw == null || raw.isBlank()) return;
    refreshTokens
        .findForUpdate(AuthService.hash(raw))
        .filter(t -> "MANAGER".equals(t.getAudience()))
        .ifPresent(
            t -> {
              if ("ACTIVE".equals(t.getStatus())) {
                t.setStatus("REVOKED");
                t.setRevokeReason("LOGOUT");
                t.setRevokedAt(Instant.now());
                refreshTokens.save(t);
              }
            });
  }

  public ResponseCookie cookie(String raw) {
    return ResponseCookie.from("managerRefreshToken", raw)
        .httpOnly(true)
        .secure(secureCookie)
        .sameSite("Lax")
        .path("/api/manager/auth")
        .maxAge(Duration.ofDays(refreshDays))
        .build();
  }

  public ResponseCookie clearCookie() {
    return ResponseCookie.from("managerRefreshToken", "")
        .httpOnly(true)
        .secure(secureCookie)
        .sameSite("Lax")
        .path("/api/manager/auth")
        .maxAge(Duration.ZERO)
        .build();
  }

  private Session issue(User user, String family) {
    String raw = UUID.randomUUID() + "." + UUID.randomUUID();
    RefreshToken token = new RefreshToken();
    token.setUser(user);
    token.setAudience("MANAGER");
    token.setFamilyId(family);
    token.setTokenHash(AuthService.hash(raw));
    token.setExpiresAt(Instant.now().plus(Duration.ofDays(refreshDays)));
    refreshTokens.save(token);
    return new Session(jwt.issue(user.getId(), "MANAGER"), raw, user);
  }

  private ApiException invalidRefresh() {
    return new ApiException(
        HttpStatus.UNAUTHORIZED,
        "INVALID_REFRESH_TOKEN",
        "Phiên manager không hợp lệ hoặc đã hết hạn.");
  }

  public record Session(String accessToken, String refreshToken, User user) {}
}
