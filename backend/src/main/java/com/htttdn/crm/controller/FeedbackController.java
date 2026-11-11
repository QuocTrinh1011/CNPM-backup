package com.htttdn.crm.controller;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.service.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
public class FeedbackController {
  private final AuthService auth;
  private final FeedbackRepository feedback;
  private final OrderRepository orders;

  public FeedbackController(
      AuthService auth,
      UserRepository users,
      ProductRepository products,
      FeedbackRepository feedback,
      OrderRepository orders) {
    this.auth = auth;
    this.feedback = feedback;
    this.orders = orders;
  }

  @GetMapping("/api/products/{productId}/feedback")
  public List<FeedbackView> list(@PathVariable Long productId) {
    return feedback
        .findByProductIdAndHiddenFalseAndDeletedAtIsNullOrderByCreatedAtDesc(productId)
        .stream()
        .map(this::view)
        .toList();
  }

  @GetMapping("/api/orders/{orderId}/reviews")
  public List<Eligibility> eligibility(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long orderId) {
    User customer = auth.requireCustomer(authorization);
    Order order =
        orders.findByIdAndCustomerId(orderId, customer.getId()).orElseThrow(this::notFound);
    Set<Long> reviewed = new HashSet<>();
    feedback.findByOrderId(orderId).forEach(f -> reviewed.add(f.getProduct().getId()));
    return order.getItems().stream()
        .map(i -> i.getProduct().getId())
        .distinct()
        .map(
            id ->
                new Eligibility(
                    id,
                    reviewed.contains(id),
                    "COMPLETED".equals(order.getStatus()) && !reviewed.contains(id)))
        .toList();
  }

  @PostMapping("/api/products/{productId}/feedback")
  @Transactional
  public ResponseEntity<FeedbackView> create(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long productId,
      @Valid @RequestBody FeedbackRequest request) {
    User customer = auth.requireCustomer(authorization);
    Order order =
        orders
            .findForStatusUpdate(request.orderId())
            .filter(o -> Objects.equals(o.getCustomer().getId(), customer.getId()))
            .orElseThrow(this::notFound);
    if (!"COMPLETED".equals(order.getStatus()))
      throw new ApiException(
          HttpStatus.FORBIDDEN,
          "RECEIPT_REQUIRED",
          "Vui lòng xác nhận đã nhận hàng trước khi đánh giá.");
    Product product =
        order.getItems().stream()
            .map(OrderItem::getProduct)
            .filter(p -> Objects.equals(p.getId(), productId))
            .findFirst()
            .orElseThrow(this::notFound);
    if (feedback.existsByOrderIdAndProductId(order.getId(), productId))
      throw new ApiException(
          HttpStatus.CONFLICT, "DUPLICATE_FEEDBACK", "Bạn đã đánh giá sản phẩm trong đơn này.");
    Feedback item = new Feedback();
    item.setOrder(order);
    item.setCustomer(customer);
    item.setProduct(product);
    item.setRating(request.rating());
    String content = request.comment() == null ? "" : request.comment().trim();
    item.setComment(content.isEmpty() ? "Đánh giá không kèm bình luận." : content);
    item.setStatus("NEW");
    item.setCreatedAt(Instant.now());
    return ResponseEntity.status(HttpStatus.CREATED).body(view(feedback.saveAndFlush(item)));
  }

  private ApiException notFound() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hoặc sản phẩm trong đơn.");
  }

  private FeedbackView view(Feedback f) {
    return new FeedbackView(
        f.getId(),
        f.getCustomer().getFullName(),
        f.getRating(),
        f.getComment(),
        f.getCreatedAt(),
        f.getAdminResponse());
  }

  public record Eligibility(Long productId, boolean reviewed, boolean canReview) {}

  public record FeedbackRequest(
      @NotNull Long orderId, @Min(1) @Max(5) int rating, @Size(max = 4000) String comment) {}

  public record FeedbackView(
      Long id,
      String customerName,
      int rating,
      String comment,
      Instant createdAt,
      String adminResponse) {}
}
