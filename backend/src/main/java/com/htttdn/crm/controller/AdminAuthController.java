package com.htttdn.crm.controller;

import com.htttdn.crm.service.AdminAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Arrays;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {
  private final AdminAuthService auth;

  public AdminAuthController(AdminAuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(
      @Valid @RequestBody LoginRequest request, HttpServletResponse response) {
    AdminAuthService.Session session = auth.login(request.email(), request.password());
    response.addHeader(HttpHeaders.SET_COOKIE, auth.cookie(session.refreshToken()).toString());
    return ResponseEntity.ok(Map.of("accessToken", session.accessToken(), "admin", session.user()));
  }

  @PostMapping("/refresh")
  public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
    AdminAuthService.Session session = auth.refresh(cookie(request));
    response.addHeader(HttpHeaders.SET_COOKIE, auth.cookie(session.refreshToken()).toString());
    return ResponseEntity.ok(Map.of("accessToken", session.accessToken(), "admin", session.user()));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
    auth.logout(cookie(request));
    response.addHeader(HttpHeaders.SET_COOKIE, auth.clearCookie().toString());
    return ResponseEntity.noContent().build();
  }

  private String cookie(HttpServletRequest request) {
    if (request.getCookies() == null) return null;
    return Arrays.stream(request.getCookies())
        .filter(c -> "adminRefreshToken".equals(c.getName()))
        .map(Cookie::getValue)
        .findFirst()
        .orElse(null);
  }

  public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
}
