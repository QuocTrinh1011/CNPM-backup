package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class ResendRecoveryTest {
  private final UserRepository users = mock(UserRepository.class);
  private final PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
  private final RefreshTokenRepository sessions = mock(RefreshTokenRepository.class);
  private final PasswordEncoder encoder = mock(PasswordEncoder.class);
  private final TransactionalMail mail = mock(TransactionalMail.class);

  private AuthService service() {
    var service = new AuthService(users, sessions, tokens, encoder, null, null);
    ReflectionTestUtils.setField(service, "mail", mail);
    ReflectionTestUtils.setField(service, "resetCodeMinutes", 15L);
    when(mail.available()).thenReturn(true);
    when(mail.permits("owner@example.com")).thenReturn(true);
    when(mail.link(anyString())).thenAnswer(a -> "https://example.com" + a.getArgument(0));
    return service;
  }

  private User customer() {
    var user = new User();
    ReflectionTestUtils.setField(user, "id", 7L);
    user.setRole("CUSTOMER");
    user.setEmail("owner@example.com");
    return user;
  }

  @Test
  void sendsOnlyToOwnerStoresHashAndDoesNotExposeToken() {
    var service = service();
    when(users.findForPasswordReset("owner@example.com")).thenReturn(Optional.of(customer()));
    when(tokens.findFirstByCustomerIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.empty());
    assertNull(service.requestPasswordReset(" OWNER@example.com "));
    var token = ArgumentCaptor.forClass(PasswordResetToken.class);
    verify(tokens).save(token.capture());
    var text = ArgumentCaptor.forClass(String.class);
    verify(mail).send(eq("owner@example.com"), anyString(), text.capture(), anyString());
    var code = text.getValue().split("&code=")[1].split("\\n")[0];
    assertEquals(43, code.length());
    assertEquals(AuthService.hash(code), token.getValue().getTokenHash());
    assertFalse(token.getValue().getTokenHash().contains(code));
  }

  @Test
  void excludesOtherRecipientsAndDoesNotRedirect() {
    var service = service();
    assertNull(service.requestPasswordReset("other@example.com"));
    verifyNoInteractions(users, tokens);
    verify(mail, never()).send(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void cooldownAndMailFailurePreserveExistingToken() {
    var service = service();
    when(users.findForPasswordReset("owner@example.com")).thenReturn(Optional.of(customer()));
    var recent = new PasswordResetToken();
    when(tokens.findFirstByCustomerIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(recent));
    assertNull(service.requestPasswordReset("owner@example.com"));
    verify(tokens, never()).deleteByCustomerId(anyLong());
    when(tokens.findFirstByCustomerIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.empty());
    doThrow(new IllegalStateException("provider error"))
        .when(mail)
        .send(anyString(), anyString(), anyString(), anyString());
    assertNull(service.requestPasswordReset("owner@example.com"));
    verify(tokens, never()).save(any());
  }

  @Test
  void tokenIsSingleUseAndRevokesSessions() {
    var service = service();
    var user = customer();
    var token = new PasswordResetToken();
    token.setCustomer(user);
    token.setExpiresAt(Instant.now().plusSeconds(900));
    when(users.findForPasswordReset("owner@example.com")).thenReturn(Optional.of(user));
    String secret = "A".repeat(43);
    when(tokens.findByTokenHash(AuthService.hash(secret))).thenReturn(Optional.of(token));
    when(encoder.encode("Password123")).thenReturn("encoded");
    service.resetPassword("owner@example.com", secret, "Password123");
    assertNotNull(token.getUsedAt());
    verify(sessions).revokeByUserId(7L);
    assertThrows(
        ApiException.class,
        () -> service.resetPassword("owner@example.com", secret, "Password123"));
    verify(sessions, times(1)).revokeByUserId(7L);
  }

  @Test
  void sandboxAndOriginMustBeConfigured() {
    var real = new TransactionalMail(new com.fasterxml.jackson.databind.ObjectMapper());
    assertFalse(real.available());
    ReflectionTestUtils.setField(real, "enabled", true);
    ReflectionTestUtils.setField(real, "apiKey", "test-only");
    ReflectionTestUtils.setField(real, "origin", "https://example.com");
    ReflectionTestUtils.setField(real, "testMode", true);
    ReflectionTestUtils.setField(real, "testRecipient", "owner@example.com");
    assertTrue(real.permits("OWNER@example.com"));
    assertFalse(real.permits("other@example.com"));
    ReflectionTestUtils.setField(real, "origin", "http://example.com");
    assertFalse(real.available());
  }

  @Test
  void expiredLinksAndLegacySixDigitCodesAreRejected() {
    var service = service();
    var user = customer();
    String secret = "B".repeat(43);
    var expired = new PasswordResetToken();
    expired.setCustomer(user);
    expired.setExpiresAt(Instant.now().minusSeconds(1));
    when(users.findForPasswordReset("owner@example.com")).thenReturn(Optional.of(user));
    when(tokens.findByTokenHash(AuthService.hash(secret))).thenReturn(Optional.of(expired));
    assertThrows(
        ApiException.class,
        () -> service.resetPassword("owner@example.com", secret, "Password123"));
    assertThrows(
        ApiException.class,
        () -> service.resetPassword("owner@example.com", "123456", "Password123"));
    verifyNoInteractions(encoder, sessions);
  }
}
