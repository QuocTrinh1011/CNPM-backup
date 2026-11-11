package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.htttdn.crm.dto.admin.AdminDtos.LockRequest;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.RefreshTokenRepository;
import com.htttdn.crm.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminUserServiceTest {
  private final UserRepository users = mock(UserRepository.class);
  private final RefreshTokenRepository tokens = mock(RefreshTokenRepository.class);
  private final NotificationService notifications = mock(NotificationService.class);
  private final AdminUserService service = new AdminUserService(users, tokens, notifications);
  private User customer;

  @BeforeEach
  void setUp() {
    customer = new User();
    customer.setRole("CUSTOMER");
    customer.setFullName("Khách hàng");
    org.springframework.test.util.ReflectionTestUtils.setField(customer, "id", 5L);
    when(users.findById(5L)).thenReturn(Optional.of(customer));
    when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
  }

  @Test
  void lockingRequiresNonblankReason() {
    ApiException error =
        assertThrows(ApiException.class, () -> service.lock(5L, new LockRequest(true, "  ")));
    assertEquals("LOCK_REASON_REQUIRED", error.code());
    assertFalse(customer.isLocked());
    verifyNoInteractions(tokens, notifications);
  }

  @Test
  void lockingCreatesNotificationAndRevokesSessions() {
    service.lock(5L, new LockRequest(true, "  Vi phạm quy định  "));
    assertTrue(customer.isLocked());
    assertEquals("Vi phạm quy định", customer.getLockReason());
    verify(notifications)
        .create(customer, "Tài khoản đã bị khóa", "Vi phạm quy định", "ACCOUNT_LOCKED", null);
    verify(tokens).revokeByUserId(5L);
  }

  @Test
  void unlockingClearsCurrentReasonAndDoesNotErasePastNotification() {
    customer.setLocked(true);
    customer.setLockReason("Lý do trước");
    service.lock(5L, new LockRequest(false, null));
    assertFalse(customer.isLocked());
    assertNull(customer.getLockReason());
    verifyNoInteractions(notifications);
  }

  @Test
  void deletingSoftlyKeepsUserRecord() {
    service.delete(5L);
    assertNotNull(customer.getDeletedAt());
    assertTrue(customer.isLocked());
    verify(users).save(customer);
    verify(users, never()).delete(any(User.class));
    verify(tokens).revokeByUserId(5L);
  }

  @Test
  void adminAccountCannotBeChangedThroughCustomerEndpoints() {
    customer.setRole("ADMIN");
    assertThrows(
        java.util.NoSuchElementException.class,
        () -> service.lock(5L, new LockRequest(true, "Không hợp lệ")));
    assertThrows(java.util.NoSuchElementException.class, () -> service.delete(5L));
    verify(users, never()).save(any());
  }

  @Test
  void deletedCustomerCannotBeModifiedAgain() {
    customer.setDeletedAt(java.time.Instant.now());
    assertThrows(
        java.util.NoSuchElementException.class,
        () -> service.lock(5L, new LockRequest(false, null)));
    assertThrows(java.util.NoSuchElementException.class, () -> service.delete(5L));
  }
}
