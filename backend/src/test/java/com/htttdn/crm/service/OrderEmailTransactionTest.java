package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.CustomerNotificationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

class OrderEmailTransactionTest {
  @Test
  void publishesImmutableMessageOnlyForEligibleOrderNotifications() {
    var repository = mock(CustomerNotificationRepository.class);
    var publisher = mock(ApplicationEventPublisher.class);
    var mail = mock(TransactionalMail.class);
    var service = new NotificationService(repository);
    ReflectionTestUtils.setField(service, "events", publisher);
    ReflectionTestUtils.setField(service, "mail", mail);
    var user = new User();
    user.setEmail("owner@example.com");
    when(mail.permits(user.getEmail())).thenReturn(true);
    when(mail.link(anyString())).thenReturn("https://example.com/don-hang/7");
    service.create(user, "Đang giao", "Đơn đang giao", "ORDER_STATUS", 7L);
    verify(publisher).publishEvent(any(TransactionalMail.OrderEmail.class));
    clearInvocations(publisher);
    service.create(user, "Khảo sát", "Khảo sát mới", "SURVEY_PUBLISHED", null);
    verifyNoInteractions(publisher);
    when(mail.permits(user.getEmail())).thenReturn(false);
    service.create(user, "Đang giao", "Đơn đang giao", "ORDER_STATUS", 7L);
    verifyNoInteractions(publisher);
  }

  @Test
  void listenerRequiresCommitAndSwallowsProviderFailure() {
    var mail = spy(new TransactionalMail(new com.fasterxml.jackson.databind.ObjectMapper()));
    doReturn(true).when(mail).permits(anyString());
    doThrow(new IllegalStateException("provider"))
        .when(mail)
        .send(anyString(), anyString(), anyString(), anyString());
    assertDoesNotThrow(
        () ->
            mail.afterOrderCommit(
                new TransactionalMail.OrderEmail("owner@example.com", "subject", "text", "key")));
    try {
      assertEquals(
          org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT,
          TransactionalMail.class
              .getMethod("afterOrderCommit", TransactionalMail.OrderEmail.class)
              .getAnnotation(org.springframework.transaction.event.TransactionalEventListener.class)
              .phase());
    } catch (NoSuchMethodException e) {
      throw new AssertionError(e);
    }
  }
}
