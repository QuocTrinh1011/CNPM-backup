package com.htttdn.crm.controller;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.service.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/surveys")
public class SurveyController {
  @org.springframework.beans.factory.annotation.Autowired
  private com.htttdn.crm.service.SurveyRewardService rewards;

  private final SurveyRepository surveys;
  private final SurveyResponseRepository responses;
  private final AuthService auth;

  public SurveyController(
      SurveyRepository surveys, SurveyResponseRepository responses, AuthService auth) {
    this.surveys = surveys;
    this.responses = responses;
    this.auth = auth;
  }

  @GetMapping
  public List<Survey> active() {
    Instant now = Instant.now();
    return surveys.findByStatusOrderByCreatedAtDesc("PUBLISHED").stream()
        .filter(s -> available(s, now) && "ALL".equals(s.getAudience()))
        .toList();
  }

  @GetMapping("/mine")
  public List<SurveyView> mine(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    User customer = auth.requireCustomer(authorization);
    return surveys.findByStatusOrderByCreatedAtDesc("PUBLISHED").stream()
        .filter(
            s ->
                available(s, Instant.now())
                    && ("ALL".equals(s.getAudience())
                        || s.getRecipients().contains(customer.getId())))
        .map(
            s ->
                new SurveyView(
                    s.getId(),
                    s.getTitle(),
                    s.getDescription(),
                    s.getStartsAt(),
                    s.getEndsAt(),
                    responses.existsByCustomerIdAndSurveyId(customer.getId(), s.getId()),
                    s.getQuestions(),
                    s.getReward()))
        .toList();
  }

  @GetMapping("/{id:\\d+}")
  public Survey get(
      @PathVariable Long id,
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    Survey survey = surveys.findByIdAndStatus(id, "PUBLISHED").orElseThrow(this::unavailable);
    if (!available(survey, Instant.now())) throw unavailable();
    if (!"ALL".equals(survey.getAudience())
        && !survey.getRecipients().contains(auth.requireCustomer(authorization).getId()))
      throw unavailable();
    return survey;
  }

  @PostMapping("/{id:\\d+}/responses")
  @org.springframework.transaction.annotation.Transactional
  public ResponseEntity<?> respond(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id,
      @Valid @RequestBody ResponseRequest request) {
    User customer = auth.requireCustomer(authorization);
    Survey survey = surveys.findForUpdate(id).orElseThrow(this::unavailable);
    if (!available(survey, Instant.now())) throw unavailable();
    if (!"ALL".equals(survey.getAudience()) && !survey.getRecipients().contains(customer.getId()))
      throw unavailable();
    if (responses.existsByCustomerIdAndSurveyId(customer.getId(), id))
      throw new ApiException(
          HttpStatus.CONFLICT, "DUPLICATE_RESPONSE", "Bạn đã hoàn thành khảo sát này.");
    Map<Long, String> answers = new HashMap<>();
    Map<Long, SurveyQuestion> questions = new HashMap<>();
    for (var q : survey.getQuestions()) questions.put(q.getId(), q);
    if (request.answers() != null)
      for (var a : request.answers()) {
        if (a == null || a.questionId() == null || !questions.containsKey(a.questionId()))
          throw com.htttdn.crm.service.SurveyValidation.invalid("Câu hỏi không thuộc khảo sát.");
        if (answers.containsKey(a.questionId()))
          throw com.htttdn.crm.service.SurveyValidation.invalid("Câu hỏi bị gửi trùng.");
        String value = a.value() == null ? "" : a.value().trim();
        if (value.length() > 4000)
          throw com.htttdn.crm.service.SurveyValidation.invalid("Câu trả lời tối đa 4.000 ký tự.");
        var q = questions.get(a.questionId());
        if ("MULTIPLE_CHOICE".equals(q.getType()) && !value.isEmpty()) {
          var selected = com.htttdn.crm.service.SurveyValidation.array(value);
          var options = com.htttdn.crm.service.SurveyValidation.array(q.getOptionsJson());
          if (!options.containsAll(selected))
            throw com.htttdn.crm.service.SurveyValidation.invalid("Đáp án không hợp lệ.");
          value = selected.isEmpty() ? "" : com.htttdn.crm.service.SurveyValidation.json(selected);
        } else if (("SINGLE_CHOICE".equals(q.getType()) || "SINGLE".equals(q.getType()))
            && !value.isEmpty()) {
          if (!com.htttdn.crm.service.SurveyValidation.array(q.getOptionsJson()).contains(value))
            throw com.htttdn.crm.service.SurveyValidation.invalid("Đáp án không hợp lệ.");
        }
        answers.put(a.questionId(), value);
      }
    for (var q : survey.getQuestions())
      if (q.isRequired() && answers.getOrDefault(q.getId(), "").isBlank())
        throw com.htttdn.crm.service.SurveyValidation.invalid(
            "Vui lòng trả lời đầy đủ câu hỏi bắt buộc.");
    answers.values().removeIf(String::isBlank);
    SurveyResponse response = new SurveyResponse();
    response.setCustomer(customer);
    response.setSurvey(survey);
    for (SurveyQuestion q : survey.getQuestions()) {
      if (!answers.containsKey(q.getId())) continue;
      SurveyAnswer a = new SurveyAnswer();
      a.setResponse(response);
      a.setQuestion(q);
      a.setAnswer(answers.get(q.getId()));
      response.getAnswers().add(a);
    }
    try {
      responses.saveAndFlush(response);
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(
          HttpStatus.CONFLICT, "DUPLICATE_RESPONSE", "Bạn đã hoàn thành khảo sát này.");
    }
    StoreVoucher reward = rewards.grant(survey, customer);
    Map<String, Object> result = new HashMap<>();
    result.put("message", "Cảm ơn bạn đã hoàn thành khảo sát.");
    result.put("surveyId", id);
    if (reward != null) result.put("voucher", VoucherController.view(reward));
    return ResponseEntity.status(HttpStatus.CREATED).body(result);
  }

  private boolean available(Survey s, Instant now) {
    return s.getDeletedAt() == null
        && "PUBLISHED".equals(s.getStatus())
        && (s.getStartsAt() == null || !now.isBefore(s.getStartsAt()))
        && (s.getEndsAt() == null || now.isBefore(s.getEndsAt()));
  }

  private ApiException unavailable() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "SURVEY_NOT_AVAILABLE", "Khảo sát không còn khả dụng.");
  }

  public record SurveyView(
      Long id,
      String title,
      String description,
      Instant startsAt,
      Instant endsAt,
      boolean completed,
      List<SurveyQuestion> questions,
      SurveyReward reward) {}

  public record ResponseRequest(List<AnswerRequest> answers) {}

  public record AnswerRequest(@NotNull Long questionId, @Size(max = 4000) String value) {}
}
