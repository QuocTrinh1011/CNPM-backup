package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.htttdn.crm.entity.RefreshToken;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceAccountStateTest {
  private final UserRepository users = mock(UserRepository.class);
  private final RefreshTokenRepository tokens = mock(RefreshTokenRepository.class);
  private final PasswordEncoder encoder = mock(PasswordEncoder.class);
  private final JwtTokenService jwt = mock(JwtTokenService.class);
  private final AuthService service =
      new AuthService(
          users,
          tokens,
          mock(PasswordResetTokenRepository.class),
          encoder,
          new ObjectMapper(),
          jwt);
  private User customer;

  @BeforeEach
  void setUp() {
    customer = new User();
    customer.setRole("CUSTOMER");
    customer.setEmail("customer@example.com");
    customer.setPasswordHash("hashed");
    org.springframework.test.util.ReflectionTestUtils.setField(customer, "id", 5L);
    when(users.findByEmailIgnoreCase("customer@example.com")).thenReturn(Optional.of(customer));
  }

  @Test
  void wrongPasswordDoesNotExposeLockReason() {
    customer.setLocked(true);
    customer.setLockReason("Lý do riêng");
    when(encoder.matches("wrong", "hashed")).thenReturn(false);
    ApiException error =
        assertThrows(ApiException.class, () -> service.login("customer@example.com", "wrong"));
    assertEquals("INVALID_CREDENTIALS", error.code());
    assertFalse(error.getMessage().contains("Lý do riêng"));
  }

  @Test
  void correctPasswordShowsLockReason() {
    customer.setLocked(true);
    customer.setLockReason("Vi phạm quy định");
    when(encoder.matches("correct", "hashed")).thenReturn(true);
    ApiException error =
        assertThrows(ApiException.class, () -> service.login("customer@example.com", "correct"));
    assertEquals("ACCOUNT_LOCKED", error.code());
    assertEquals(423, error.status().value());
    assertTrue(error.getMessage().contains("Vi phạm quy định"));
  }

  @Test
  void deletedCustomerCannotLoginOrUseExistingAccessToken() {
    customer.setDeletedAt(Instant.now());
    when(encoder.matches("correct", "hashed")).thenReturn(true);
    assertEquals(
        "ACCOUNT_REMOVED",
        assertThrows(ApiException.class, () -> service.login("customer@example.com", "correct"))
            .code());
    when(jwt.parse("Bearer token")).thenReturn(new JwtTokenService.Claims(5L, "CUSTOMER"));
    when(users.findById(5L)).thenReturn(Optional.of(customer));
    assertEquals(
        "UNAUTHORIZED",
        assertThrows(ApiException.class, () -> service.requireCustomer("Bearer token")).code());
  }

  @Test
  void lockedCustomerCannotRefreshOrUseExistingAccessToken() {
    customer.setLocked(true);
    customer.setLockReason("Chờ xác minh");
    RefreshToken token = new RefreshToken();
    token.setUser(customer);
    token.setAudience("CUSTOMER");
    token.setExpiresAt(Instant.now().plusSeconds(600));
    when(tokens.findForUpdate(anyString())).thenReturn(Optional.of(token));
    assertEquals(
        "ACCOUNT_LOCKED",
        assertThrows(ApiException.class, () -> service.refresh("refresh-token")).code());
    when(jwt.parse("Bearer token")).thenReturn(new JwtTokenService.Claims(5L, "CUSTOMER"));
    when(users.findById(5L)).thenReturn(Optional.of(customer));
    assertEquals(
        "ACCOUNT_LOCKED",
        assertThrows(ApiException.class, () -> service.requireCustomer("Bearer token")).code());
  }
}
