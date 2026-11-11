package com.htttdn.crm.security;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class StartupSecurityValidationTest {
  final String valid = "0123456789abcdef0123456789abcdef";

  @Test
  void rejectsMissingBlankShortAndSampleSecretsWithoutEchoingThem() {
    for (String value :
        new String[] {
          null,
          "",
          " ",
          "short",
          "dev-only-0123456789abcdef0123456789abcdef",
          "change-me-0123456789abcdef0123456789abcdef"
        }) {
      var e =
          assertThrows(
              IllegalStateException.class,
              () ->
                  new StartupSecurityValidation("db", value, "jdbc:postgresql:test")
                      .afterPropertiesSet());
      assertTrue(e.getMessage().startsWith("JWT_SECRET"));
      if (value != null && !value.isBlank()) assertFalse(e.getMessage().contains(value));
    }
  }

  @Test
  void validatesPasswordAndCountsUtf8Bytes() {
    for (String value : new String[] {null, "", " "})
      assertThrows(
          IllegalStateException.class,
          () ->
              new StartupSecurityValidation(value, valid, "jdbc:postgresql:test")
                  .afterPropertiesSet());
    assertDoesNotThrow(
        () ->
            new StartupSecurityValidation("db", valid, "jdbc:postgresql:test")
                .afterPropertiesSet());
    assertDoesNotThrow(
        () ->
            new StartupSecurityValidation("", "á".repeat(16), "jdbc:h2:mem:test")
                .afterPropertiesSet());
  }
}
