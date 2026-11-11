package com.htttdn.crm.dto.admin;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

public final class AdminDtos {
  private AdminDtos() {}

  public record UserRequest(@NotBlank String fullName, String phone, String preferences) {}

  public record LockRequest(boolean locked, @Size(max = 2000) String reason) {}

  public record FeedbackRequest(
      @Size(max = 30) String status, @Size(max = 4000) String adminResponse, Boolean hidden) {}

  public record StatusRequest(@NotBlank String status, String reason) {}

  public record StockRequest(@Min(0) int quantity) {}

  public record ProductRequest(
      @NotBlank String name,
      String category,
      String description,
      @NotNull @DecimalMin("0.0") BigDecimal price,
      @Min(0) int stock,
      String imageUrl) {}

  public record QuestionRequest(
      @NotBlank String text, @NotBlank String type, String optionsJson, Boolean required) {}

  public record SurveyRequest(
      @NotBlank String title,
      String description,
      Instant startsAt,
      Instant endsAt,
      List<QuestionRequest> questions,
      com.htttdn.crm.entity.SurveyReward reward,
      String audience,
      List<Long> customerIds,
      com.htttdn.crm.service.CustomerLifecycleQuery.RecipientFilter recipientFilter) {
    public SurveyRequest {
      if (questions == null) questions = List.of();
    }

    public SurveyRequest(
        String title,
        String description,
        Instant startsAt,
        Instant endsAt,
        List<QuestionRequest> questions,
        com.htttdn.crm.entity.SurveyReward reward,
        String audience,
        List<Long> customerIds) {
      this(title, description, startsAt, endsAt, questions, reward, audience, customerIds, null);
    }

    public SurveyRequest(
        String title,
        String description,
        Instant startsAt,
        Instant endsAt,
        List<QuestionRequest> questions,
        com.htttdn.crm.entity.SurveyReward reward) {
      this(title, description, startsAt, endsAt, questions, reward, "ALL", List.of(), null);
    }

    public SurveyRequest(
        String title,
        String description,
        Instant startsAt,
        Instant endsAt,
        List<QuestionRequest> questions) {
      this(title, description, startsAt, endsAt, questions, null);
    }
  }
}
