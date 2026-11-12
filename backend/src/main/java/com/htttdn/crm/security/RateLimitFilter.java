package com.htttdn.crm.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.service.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Two-tier rate limiter: a per-IP token bucket on every API request, and a per-IP+account limit on failed auth attempts. */
final class RateLimitFilter extends OncePerRequestFilter {
    private static final Set<String> AUTH_PATHS = Set.of(
            "/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/forgot-password",
            "/api/auth/reset-password", "/api/auth/change-password",
            "/api/admin/auth/login", "/api/manager/auth/login");
    private static final String WEBHOOK_PATH = "/api/payments/payos/webhook";

    private final RateLimitStore store;
    private final ObjectMapper mapper;
    private final boolean enabled;
    private final int maxBodyBytes;
    private final Set<String> trustedProxyIps;

    RateLimitFilter(RateLimitStore store, ObjectMapper mapper, boolean enabled, int maxBodyBytes, String trustedProxies) {
        this.store = store;
        this.mapper = mapper;
        this.enabled = enabled;
        this.maxBodyBytes = maxBodyBytes;
        this.trustedProxyIps = Arrays.stream(trustedProxies.split(","))
                .map(RateLimitFilter::canonicalIp)
                .filter(ip -> ip != null)
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean webhook = "POST".equals(request.getMethod()) && WEBHOOK_PATH.equals(path);
        if (!enabled || "OPTIONS".equalsIgnoreCase(request.getMethod()) || webhook) { chain.doFilter(request, response); return; }

        CachedBodyRequest wrapped = new CachedBodyRequest(request, maxBodyBytes);
        if (wrapped.bodyTooLarge()) { writeJsonError(response, 413, "PAYLOAD_TOO_LARGE", "Payload quá lớn. Giới hạn " + maxBodyBytes / 1024 + " KB.", null); return; }
        String ipHash = AuthService.hash(clientIp(request));
        if (!store.tryConsumeGlobal(ipHash)) { write429(response, store.globalRetryAfterSeconds(ipHash)); return; }

        String authKey = null;
        if ("POST".equals(request.getMethod()) && AUTH_PATHS.contains(path)) {
            authKey = authKey(ipHash, wrapped);
            if (store.isAuthBlocked(authKey)) { write429(response, store.authRetryAfterSeconds(authKey)); return; }
        }

        chain.doFilter(wrapped, response);
        if (authKey != null && response.getStatus() >= 400) store.recordAuthFailure(authKey);
    }

    private String authKey(String ipHash, CachedBodyRequest request) {
        String email = null;
        try {
            byte[] body = request.cachedBody();
            if (body.length > 0) {
                JsonNode node = mapper.readTree(body);
                email = node.path("email").asText(null);
            }
        } catch (Exception ignored) { }
        if (email == null || email.isBlank()) return ipHash + ":noemail";
        return ipHash + ":" + AuthService.hash(email.trim().toLowerCase(Locale.ROOT));
    }

    private String clientIp(HttpServletRequest request) {
        String remoteAddress = request.getRemoteAddr();
        String canonicalRemoteAddress = canonicalIp(remoteAddress);
        if (canonicalRemoteAddress != null) remoteAddress = canonicalRemoteAddress;
        if (remoteAddress == null) remoteAddress = "unknown";
        if (!trustedProxyIps.contains(remoteAddress)) return remoteAddress;

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] addresses = forwarded.split(",");
            for (int index = addresses.length - 1; index >= 0; index--) {
                String candidate = canonicalIp(addresses[index].trim());
                if (candidate != null && !trustedProxyIps.contains(candidate)) return candidate;
            }
        }
        return remoteAddress;
    }

    private static String canonicalIp(String value) {
        if (value == null || value.isBlank()) return null;
        String address = value.trim();
        String[] octets = address.split("\\.", -1);
        if (octets.length == 4) {
            StringBuilder canonical = new StringBuilder();
            for (String octet : octets) {
                if (!octet.matches("[0-9]{1,3}") || (octet.length() > 1 && octet.charAt(0) == '0')) return null;
                int number;
                try {
                    number = Integer.parseInt(octet);
                } catch (NumberFormatException ignored) {
                    return null;
                }
                if (number < 0 || number > 255) return null;
                if (!canonical.isEmpty()) canonical.append('.');
                canonical.append(number);
            }
            return canonical.toString();
        }
        if (!address.contains(":") || !address.matches("[0-9a-fA-F:.]+")) return null;
        try {
            return InetAddress.getByName(address).getHostAddress().toLowerCase(Locale.ROOT);
        } catch (UnknownHostException ignored) {
            return null;
        }
    }

    private static void write429(HttpServletResponse response, long retryAfterSeconds) throws IOException {
        writeJsonError(response, 429, "RATE_LIMITED", "Quá nhiều yêu cầu. Vui lòng thử lại sau.", String.valueOf(retryAfterSeconds));
    }

    private static void writeJsonError(HttpServletResponse response, int status, String code, String message, String retryAfter) throws IOException {
        response.setStatus(status);
        if (retryAfter != null) response.setHeader("Retry-After", retryAfter);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().print("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
