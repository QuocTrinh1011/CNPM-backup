package com.htttdn.crm.controller;

import com.htttdn.crm.dto.admin.AdminDtos.SurveyRequest;
import com.htttdn.crm.entity.Survey;
import com.htttdn.crm.service.AdminSurveyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/surveys")
public class AdminSurveyController {
  private final AdminSurveyService service;

  public AdminSurveyController(AdminSurveyService service) {
    this.service = service;
  }

  @GetMapping
  public Page<Survey> list(
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.list(status, page, size);
  }

  @PostMapping
  public Survey create(@Valid @RequestBody SurveyRequest r) {
    return service.create(r);
  }

  @GetMapping("/filter-options")
  public com.htttdn.crm.service.CustomerLifecycleQuery.SurveyOptions filterOptions(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(required = false) Long selectedId) {
    return service.filterOptions(q, page, size, selectedId);
  }

  public record PreviewRequest(
      com.htttdn.crm.service.CustomerLifecycleQuery.RecipientFilter recipientFilter,
      @Min(0) Integer page,
      @Min(1) @Max(200) Integer size) {}

  @PostMapping("/recipients/preview")
  public com.htttdn.crm.service.CustomerLifecycleQuery.RecipientPreview preview(
      @Valid @RequestBody PreviewRequest r) {
    return service.preview(
        r.recipientFilter(), r.page() == null ? 0 : r.page(), r.size() == null ? 10 : r.size());
  }

  public record RewardRequest(
      boolean enabled,
      @Size(max = 30) String discountType,
      @DecimalMin("0.0") java.math.BigDecimal discountValue,
      @DecimalMin("0.0") java.math.BigDecimal minOrderAmount,
      @DecimalMin("0.0") java.math.BigDecimal maxDiscountAmount,
      @Min(0) @Max(3650) Integer validDays) {}

  @PatchMapping("/{id}/reward")
  public Survey reward(@PathVariable Long id, @Valid @RequestBody RewardRequest input) {
    var reward = new com.htttdn.crm.entity.SurveyReward();
    reward.setEnabled(input.enabled());
    reward.setDiscountType(input.discountType());
    reward.setDiscountValue(input.discountValue());
    reward.setMinOrderAmount(input.minOrderAmount());
    reward.setMaxDiscountAmount(input.maxDiscountAmount());
    reward.setValidDays(input.validDays());
    return service.reward(id, reward);
  }

  @PatchMapping("/{id}/publish")
  public Survey publish(@PathVariable Long id, @RequestParam(defaultValue = "true") boolean value) {
    return service.publish(id, value);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id) {
    service.delete(id);
  }
}
