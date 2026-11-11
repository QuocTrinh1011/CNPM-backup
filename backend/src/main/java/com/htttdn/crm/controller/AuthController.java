package com.htttdn.crm.controller;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.service.AuthService;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @GetMapping("/password-recovery")
  public Map<String, Object> recovery() {
    boolean enabled = auth.passwordRecoveryEnabled();
    return Map.of(
        "enabled",
        enabled,
        "message",
        enabled
            ? "Khôi phục mật khẩu qua email đã được bật."
            : "Chưa có kênh gửi mã an toàn. Vui lòng liên hệ cửa hàng để được hỗ trợ.");
  }

  @PostMapping("/register")
  public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest r) {
    User u = auth.register(r.email(), r.password(), r.fullName(), r.phone(), r.age());
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(Map.of("message", "Đăng ký tài khoản thành công.", "customer", u));
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@Valid @RequestBody LoginRequest r, HttpServletResponse response) {
    AuthService.Session s = auth.login(r.email(), r.password());
    response.addHeader(HttpHeaders.SET_COOKIE, auth.cookie(s.refreshToken()).toString());
    return ResponseEntity.ok(
        Map.of("accessToken", s.accessToken(), "expiresIn", s.expiresIn(), "customer", s.user()));
  }

  @PostMapping("/refresh")
  public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
    AuthService.Session s = auth.refresh(cookie(request));
    response.addHeader(HttpHeaders.SET_COOKIE, auth.cookie(s.refreshToken()).toString());
    return ResponseEntity.ok(
        Map.of("accessToken", s.accessToken(), "expiresIn", s.expiresIn(), "customer", s.user()));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
    auth.logout(cookie(request));
    response.addHeader(HttpHeaders.SET_COOKIE, auth.clearCookie().toString());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/change-password")
  public ResponseEntity<Void> changePassword(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody ChangePasswordRequest r) {
    auth.changePassword(auth.requireCustomer(authorization), r.currentPassword(), r.newPassword());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/forgot-password")
  public Map<String, Object> forgotPassword(@Valid @RequestBody ForgotPasswordRequest r) {
    String code = auth.requestPasswordReset(r.email());
    Map<String, Object> result = new LinkedHashMap<>();
    result.put(
        "message",
        "Nếu tài khoản hợp lệ và được hỗ trợ gửi email, liên kết đặt lại mật khẩu sẽ được gửi tới"
            + " email của bạn. Vui lòng kiểm tra cả thư rác.");
    if (code != null) result.put("resetCode", code);
    return result;
  }

  @PostMapping("/reset-password")
  public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest r) {
    auth.resetPassword(r.email(), r.code(), r.newPassword());
    return ResponseEntity.noContent().build();
  }

  private String cookie(HttpServletRequest request) {
    if (request.getCookies() == null) return null;
    return Arrays.stream(request.getCookies())
        .filter(c -> "refreshToken".equals(c.getName()))
        .map(Cookie::getValue)
        .findFirst()
        .orElse(null);
  }

  public record RegisterRequest(
      @NotBlank @Email String email,
      @NotBlank @Size(min = 8, max = 72) String password,
      @NotBlank @Size(max = 150) String fullName,
      String phone,
      @Min(value = 13, message = "Tuổi phải từ 13 trở lên.")
          @Max(value = 120, message = "Tuổi không hợp lệ.")
          Short age) {}

  public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

  public record ChangePasswordRequest(
      @NotBlank String currentPassword, @NotBlank @Size(min = 8, max = 72) String newPassword) {}

  public record ForgotPasswordRequest(@NotBlank @Email String email) {}

  public record ResetPasswordRequest(
      @NotBlank @Email String email,
      @NotBlank
          @Pattern(regexp = "(?:[A-Za-z0-9_-]{43}|\\d{6})", message = "Mã đặt lại không hợp lệ.")
          String code,
      @NotBlank @Size(min = 8, max = 72) String newPassword) {}
}
