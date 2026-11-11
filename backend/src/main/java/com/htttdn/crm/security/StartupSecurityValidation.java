package com.htttdn.crm.security;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class StartupSecurityValidation implements InitializingBean {
  private final String password, secret, url;

  public StartupSecurityValidation(
      @Value("${spring.datasource.password}") String password,
      @Value("${app.auth.jwt-secret}") String secret,
      @Value("${spring.datasource.url}") String url) {
    this.password = password;
    this.secret = secret;
    this.url = url;
  }

  @Override
  public void afterPropertiesSet() {
    // Embedded H2 is test-only and commonly uses an empty password.
    if (!url.startsWith("jdbc:h2:") && (password == null || password.isBlank()))
      throw new IllegalStateException("DB_PASSWORD không được để trống.");
    String normalized = secret == null ? "" : secret.toLowerCase(Locale.ROOT);
    if (secret == null
        || secret.isBlank()
        || secret.getBytes(StandardCharsets.UTF_8).length < 32
        || normalized.contains("dev-only")
        || normalized.contains("change-me")
        || normalized.contains("changeme")
        || normalized.contains("your-secret"))
      throw new IllegalStateException(
          "JWT_SECRET phải có ít nhất 32 byte UTF-8 và không được dùng khóa mẫu.");
  }
}
