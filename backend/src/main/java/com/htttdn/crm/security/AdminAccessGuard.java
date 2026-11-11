package com.htttdn.crm.security;

import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.UserRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AdminAccessGuard extends OncePerRequestFilter {
  private final JwtTokenService jwt;
  private final UserRepository users;

  public AdminAccessGuard(JwtTokenService jwt, UserRepository users) {
    this.jwt = jwt;
    this.users = users;
  }

  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String path = request.getRequestURI();
    boolean manager = path.equals("/api/manager") || path.startsWith("/api/manager/");
    boolean admin = path.equals("/api/admin") || path.startsWith("/api/admin/");
    if ((!admin && !manager)
        || "OPTIONS".equalsIgnoreCase(request.getMethod())
        || path.startsWith(manager ? "/api/manager/auth/" : "/api/admin/auth/")) {
      chain.doFilter(request, response);
      return;
    }
    try {
      JwtTokenService.Claims claims = jwt.parse(request.getHeader("Authorization"));
      User user =
          users
              .findById(claims.userId())
              .orElseThrow(
                  () ->
                      new ApiException(
                          HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Admin token không hợp lệ."));
      String role = manager ? "MANAGER" : "ADMIN";
      if (!role.equals(claims.role())
          || !role.equals(user.getRole())
          || user.isLocked()
          || user.getDeletedAt() != null)
        throw new ApiException(
            HttpStatus.FORBIDDEN, role + "_REQUIRED", "Không có quyền truy cập portal này.");
      request.setAttribute(
          com.htttdn.crm.service.AuditTrail.ACTOR_ATTRIBUTE,
          new com.htttdn.crm.service.AuditTrail.Actor(user.getId(), user.getFullName(), role));
      try {
        chain.doFilter(request, response);
      } finally {
        request.removeAttribute(com.htttdn.crm.service.AuditTrail.ACTOR_ATTRIBUTE);
      }
    } catch (ApiException e) {
      response.setStatus(e.status().value());
      response.setContentType("application/json");
      response
          .getWriter()
          .print("{\"code\":\"" + e.code() + "\",\"message\":\"" + e.getMessage() + "\"}");
    }
  }
}
