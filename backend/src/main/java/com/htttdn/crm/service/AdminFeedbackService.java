package com.htttdn.crm.service;

import com.htttdn.crm.dto.admin.AdminDtos.FeedbackRequest;
import com.htttdn.crm.entity.Feedback;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.FeedbackRepository;
import java.time.Instant;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminFeedbackService extends AdminServiceSupport {
  private final FeedbackRepository feedback;

  public AdminFeedbackService(FeedbackRepository feedback) {
    this.feedback = feedback;
  }

  public Page<Feedback> list(String status, int page, int size) {
    return status == null || status.isBlank()
        ? feedback.findByDeletedAtIsNull(page(page, size))
        : feedback.findByStatusAndDeletedAtIsNull(status, page(page, size));
  }

  private Feedback getForModeration(Long id) {
    return feedback
        .findForModeration(id)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "FEEDBACK_NOT_FOUND", "Không tìm thấy phản hồi."));
  }

  @Transactional
  public Feedback update(Long id, FeedbackRequest request) {
    Feedback item = getForModeration(id);
    var before = snapshot(item);
    if (item.getDeletedAt() != null)
      throw new ApiException(
          HttpStatus.NOT_FOUND, "FEEDBACK_NOT_FOUND", "Không tìm thấy phản hồi.");
    if (request.status() != null) {
      if (!Set.of("NEW", "IN_PROGRESS", "RESOLVED").contains(request.status()))
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "INVALID_STATUS", "Trạng thái phản hồi không hợp lệ.");
      item.setStatus(request.status());
    }
    if (request.adminResponse() != null) {
      String response = request.adminResponse().trim();
      if (response.isEmpty() || response.length() > 4000)
        throw new ApiException(
            HttpStatus.BAD_REQUEST,
            "INVALID_RESPONSE",
            "Nội dung trả lời phải từ 1 đến 4.000 ký tự.");
      item.setAdminResponse(response);
    }
    if (request.hidden() != null) item.setHidden(request.hidden());
    if (request.status() != null || request.adminResponse() != null)
      item.setProcessedAt(Instant.now());
    audit("UPDATE", "FEEDBACK", id, before, item);
    return feedback.save(item);
  }

  @Transactional
  public void delete(Long id) {
    Feedback item = getForModeration(id);
    if (item.getDeletedAt() != null) return;
    var before = snapshot(item);
    item.setDeletedAt(Instant.now());
    feedback.save(item);
    audit("DELETE", "FEEDBACK", id, before, item);
  }
}
