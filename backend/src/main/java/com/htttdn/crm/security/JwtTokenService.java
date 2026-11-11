package com.htttdn.crm.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.exception.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {
  private final ObjectMapper mapper;

  @Value("${app.auth.jwt-secret}")
  private String secret;

  @Value("${app.auth.access-minutes:15}")
  private long accessMinutes;

  public JwtTokenService(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  public String issue(long userId, String role) {
    long exp = Instant.now().plusSeconds(accessMinutes * 60).getEpochSecond();
    String header = encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
    String payload =
        encode("{\"sub\":" + userId + ",\"role\":\"" + role + "\",\"exp\":" + exp + "}");
    return header + "." + payload + "." + sign(header + "." + payload);
  }

  public Claims parse(String authorization) {
    try {
      if (authorization == null || !authorization.startsWith("Bearer ")) throw new Exception();
      String[] parts = authorization.substring(7).split("\\.");
      if (parts.length != 3
          || !MessageDigestSupport.constantTimeEquals(parts[2], sign(parts[0] + "." + parts[1])))
        throw new Exception();
      JsonNode payload =
          mapper.readTree(
              new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));
      if (payload.path("exp").asLong(0) < Instant.now().getEpochSecond()) throw new Exception();
      long id = payload.path("sub").asLong(0);
      String role = payload.path("role").asText("");
      if (id <= 0 || role.isBlank()) throw new Exception();
      return new Claims(id, role);
    } catch (Exception e) {
      throw new ApiException(
          HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Token đăng nhập không hợp lệ hoặc đã hết hạn.");
    }
  }

  private String encode(String value) {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(value.getBytes(StandardCharsets.UTF_8));
  }

  private String sign(String value) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return Base64.getUrlEncoder()
          .withoutPadding()
          .encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public record Claims(long userId, String role) {}

  private static final class MessageDigestSupport {
    private static boolean constantTimeEquals(String left, String right) {
      return java.security.MessageDigest.isEqual(
          left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }
  }
}
