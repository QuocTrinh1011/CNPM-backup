package com.htttdn.crm.controller;

import com.htttdn.crm.dto.admin.AdminDtos.FeedbackRequest;
import com.htttdn.crm.entity.Feedback;
import com.htttdn.crm.service.AdminFeedbackService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/feedback")
public class AdminFeedbackController {
  private final AdminFeedbackService service;

  public AdminFeedbackController(AdminFeedbackService service) {
    this.service = service;
  }

  @GetMapping
  public Page<Feedback> list(
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.list(status, page, size);
  }

  @PatchMapping("/{id}")
  public Feedback update(@PathVariable Long id, @Valid @RequestBody FeedbackRequest r) {
    return service.update(id, r);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id) {
    service.delete(id);
  }
}
