package com.cnpm.clothingstore.security;

import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.UserRepository;
import jakarta.servlet.*; import jakarta.servlet.http.*;
import org.springframework.http.HttpStatus; import org.springframework.stereotype.Component; import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class AdminAccessGuard extends OncePerRequestFilter {
    private final JwtTokenService jwt; private final UserRepository users; private final ManagerRoleAccessPolicy managerRoles;
    public AdminAccessGuard(JwtTokenService jwt, UserRepository users, ManagerRoleAccessPolicy managerRoles) { this.jwt = jwt; this.users = users; this.managerRoles = managerRoles; }
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean manager=path.equals("/api/manager")||path.startsWith("/api/manager/");
        boolean admin=path.equals("/api/admin")||path.startsWith("/api/admin/");
        if ((!admin&&!manager) || "OPTIONS".equalsIgnoreCase(request.getMethod()) || path.startsWith(manager?"/api/manager/auth/":"/api/admin/auth/")) { chain.doFilter(request, response); return; }
        try {
            JwtTokenService.Claims claims = jwt.parse(request.getHeader("Authorization"));
            User user = users.findById(claims.userId()).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Admin token không hợp lệ."));
            String role = user.getRole();
            if (user.isLocked() || user.getDeletedAt()!=null || !role.equals(claims.role()))
                throw new ApiException(HttpStatus.FORBIDDEN, manager ? "MANAGER_ROLE_REQUIRED" : "ADMIN_REQUIRED", "Không có quyền truy cập portal này.");
            if (manager && (!ManagerRoleAccessPolicy.isManagerPortalRole(role) || !managerRoles.allows(role, request.getMethod(), path)))
                throw new ApiException(HttpStatus.FORBIDDEN, "MANAGER_SCOPE_FORBIDDEN", "Vai trò này không được phép truy cập chức năng.");
            if (admin && !"ADMIN".equals(role))
                throw new ApiException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "Không có quyền truy cập portal này.");
            request.setAttribute(com.cnpm.clothingstore.service.AuditTrail.ACTOR_ATTRIBUTE,new com.cnpm.clothingstore.service.AuditTrail.Actor(user.getId(),user.getFullName(),role));
            try { chain.doFilter(request, response); }
            finally { request.removeAttribute(com.cnpm.clothingstore.service.AuditTrail.ACTOR_ATTRIBUTE); }
        } catch (ApiException e) { response.setStatus(e.status().value()); response.setContentType("application/json"); response.getWriter().print("{\"code\":\"" + e.code() + "\",\"message\":\"" + e.getMessage() + "\"}"); }
    }
}
