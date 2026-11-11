package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.htttdn.crm.dto.admin.AdminDtos.*;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.SurveyRepository;
import java.util.*;
import org.junit.jupiter.api.Test;

class AdminSurveyServiceTest {
  final SurveyRepository repo = mock(SurveyRepository.class);
  final AdminSurveyService service = new AdminSurveyService(repo);

  @Test
  void createsOrderedChoiceQuestionsAndDefaultsRequired() {
    when(repo.save(any())).thenAnswer(a -> a.getArgument(0));
    Survey s =
        service.create(
            new SurveyRequest(
                "Test",
                "",
                null,
                null,
                List.of(
                    new QuestionRequest("One", "SINGLE", "[\"A\",\"B\"]", null),
                    new QuestionRequest("Many", "MULTIPLE_CHOICE", "[\"A\",\"B\"]", false))));
    assertEquals("SINGLE_CHOICE", s.getQuestions().get(0).getType());
    assertTrue(s.getQuestions().get(0).isRequired());
    assertFalse(s.getQuestions().get(1).isRequired());
    assertEquals(1, s.getQuestions().get(1).getDisplayOrder());
  }

  @Test
  void rejectsEmptySurveyAndInvalidOptions() {
    assertThrows(
        ApiException.class,
        () -> service.create(new SurveyRequest("Test", "", null, null, List.of())));
    for (String raw : List.of("[]", "[\"A\"]", "[\"A\",\" A \"]", "[\"\",\"B\"]", "{}"))
      assertThrows(ApiException.class, () -> SurveyValidation.options(raw));
  }

  @Test
  void unpublishesAndSoftDeletesWithoutRemovingQuestions() {
    Survey s = new Survey();
    s.setStatus("PUBLISHED");
    s.getQuestions().add(new SurveyQuestion());
    when(repo.findForUpdate(1L)).thenReturn(Optional.of(s));
    service.publish(1L, false);
    assertEquals("DRAFT", s.getStatus());
    service.publish(1L, true);
    assertEquals("PUBLISHED", s.getStatus());
    service.delete(1L);
    var date = s.getDeletedAt();
    service.delete(1L);
    assertEquals(date, s.getDeletedAt());
    assertEquals(1, s.getQuestions().size());
    assertThrows(ApiException.class, () -> service.publish(1L, true));
    verify(repo, never()).deleteById(any());
  }

  @Test
  void preventsPublishingEmptyLegacySurvey() {
    when(repo.findForUpdate(1L)).thenReturn(Optional.of(new Survey()));
    assertThrows(ApiException.class, () -> service.publish(1L, true));
  }
}
