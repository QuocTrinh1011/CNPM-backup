package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.service.ManagerAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;

@RestController
@RequestMapping("/api/manager/auth")
public class ManagerAuthController {
    private final ManagerAuthService auth;
    public ManagerAuthController(ManagerAuthService auth) { this.auth = auth; }
    @PostMapping("/login") public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) { ManagerAuthService.Session session = auth.login(request.email(), request.password()); response.addHeader(HttpHeaders.SET_COOKIE, auth.cookie(session.refreshToken()).toString()); return ResponseEntity.ok(Map.of("accessToken", session.accessToken(), "manager", session.user())); }
    @PostMapping("/refresh") public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) { ManagerAuthService.Session session = auth.refresh(cookie(request)); response.addHeader(HttpHeaders.SET_COOKIE, auth.cookie(session.refreshToken()).toString()); return ResponseEntity.ok(Map.of("accessToken", session.accessToken(), "manager", session.user())); }
    @PostMapping("/logout") public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) { auth.logout(cookie(request)); response.addHeader(HttpHeaders.SET_COOKIE, auth.clearCookie().toString()); return ResponseEntity.noContent().build(); }
    @PostMapping("/change-password") public ResponseEntity<Void> changePassword(@RequestHeader(value="Authorization",required=false) String authorization, @Valid @RequestBody ChangePasswordRequest request) { auth.changePassword(authorization, request.currentPassword(), request.newPassword()); return ResponseEntity.noContent().build(); }
    private String cookie(HttpServletRequest request) { if (request.getCookies() == null) return null; return Arrays.stream(request.getCookies()).filter(c -> "managerRefreshToken".equals(c.getName())).map(Cookie::getValue).findFirst().orElse(null); }
    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank String newPassword) {}
}
