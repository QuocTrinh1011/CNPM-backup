package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.htttdn.crm.dto.admin.AdminDtos.FeedbackRequest;
import com.htttdn.crm.entity.Feedback;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.FeedbackRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AdminFeedbackServiceTest {
  final FeedbackRepository repository = mock(FeedbackRepository.class);
  final AdminFeedbackService service = new AdminFeedbackService(repository);
  final Feedback item = new Feedback();

  void setup() {
    when(repository.findForModeration(7L)).thenReturn(Optional.of(item));
    when(repository.save(item)).thenReturn(item);
  }

  @Test
  void hidingAndShowingDoesNotChangeProcessingState() {
    setup();
    item.setStatus("RESOLVED");
    item.setAdminResponse("Đã trả lời");
    service.update(7L, new FeedbackRequest(null, null, true));
    assertTrue(item.isHidden());
    assertEquals("RESOLVED", item.getStatus());
    assertEquals("Đã trả lời", item.getAdminResponse());
    assertNull(item.getProcessedAt());
    service.update(7L, new FeedbackRequest(null, null, false));
    assertFalse(item.isHidden());
  }

  @Test
  void deletionIsSoftIdempotentAndCannotBeUndoneByPatch() {
    setup();
    service.delete(7L);
    var deletedAt = item.getDeletedAt();
    service.delete(7L);
    assertNotNull(deletedAt);
    assertEquals(deletedAt, item.getDeletedAt());
    assertEquals(
        404,
        assertThrows(
                ApiException.class,
                () -> service.update(7L, new FeedbackRequest(null, null, false)))
            .status()
            .value());
    verify(repository, times(1)).save(item);
    verify(repository, never()).delete(any());
  }

  @Test
  void missingFeedbackReturns404() {
    when(repository.findForModeration(7L)).thenReturn(Optional.empty());
    assertEquals(404, assertThrows(ApiException.class, () -> service.delete(7L)).status().value());
  }

  @Test
  void replyIsTrimmedEditableAndIndependentOfVisibility() {
    setup();
    item.setHidden(true);
    service.update(7L, new FeedbackRequest(null, "  Cảm ơn bạn  ", null));
    assertEquals("Cảm ơn bạn", item.getAdminResponse());
    assertTrue(item.isHidden());
    assertNotNull(item.getProcessedAt());
    service.update(7L, new FeedbackRequest(null, "Shop đã hỗ trợ", null));
    assertEquals("Shop đã hỗ trợ", item.getAdminResponse());
    assertThrows(
        ApiException.class, () -> service.update(7L, new FeedbackRequest(null, "   ", null)));
    assertThrows(
        ApiException.class,
        () -> service.update(7L, new FeedbackRequest(null, "x".repeat(4001), null)));
  }

  @Test
  void missingFeedbackCannotBeRepliedTo() {
    when(repository.findForModeration(7L)).thenReturn(Optional.empty());
    assertEquals(
        404,
        assertThrows(
                ApiException.class,
                () -> service.update(7L, new FeedbackRequest(null, "Reply", null)))
            .status()
            .value());
  }

  @Test
  void listOnlyUsesNonDeletedQueries() {
    service.list(null, 0, 10);
    service.list("NEW", 0, 10);
    verify(repository).findByDeletedAtIsNull(any());
    verify(repository).findByStatusAndDeletedAtIsNull(eq("NEW"), any());
  }
}
