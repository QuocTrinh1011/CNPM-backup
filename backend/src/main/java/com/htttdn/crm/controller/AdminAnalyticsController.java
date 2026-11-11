package com.htttdn.crm.controller;

import com.htttdn.crm.service.AnalyticsService;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/reports")
public class AdminAnalyticsController {
  private final AnalyticsService service;

  public AdminAnalyticsController(AnalyticsService service) {
    this.service = service;
  }

  @GetMapping("/customers")
  public Map<String, Object> customers() {
    return service.customers();
  }

  @GetMapping("/surveys")
  public Map<String, Object> surveys(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
    return service.surveys(page, size);
  }

  @GetMapping("/surveys/{id}/results")
  public Map<String, Object> results(@PathVariable long id) {
    return service.results(id);
  }

  @GetMapping("/surveys/{id}/questions/{questionId}/answers")
  public Map<String, Object> answers(
      @PathVariable long id,
      @PathVariable long questionId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.textAnswers(id, questionId, page, size);
  }
}
