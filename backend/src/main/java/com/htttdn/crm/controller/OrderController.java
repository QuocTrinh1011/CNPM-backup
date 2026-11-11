package com.htttdn.crm.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.htttdn.crm.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.data.domain.Page;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class OrderController {
  @PatchMapping("/api/orders/{id}/confirm-receipt")
  public OrderService.OrderView confirmReceipt(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id) {
    return orders.confirmReceipt(auth.requireCustomer(authorization), id);
  }

  private final AuthService auth;
  private final OrderService orders;

  public OrderController(AuthService auth, OrderService orders) {
    this.auth = auth;
    this.orders = orders;
  }

  @PostMapping("/api/orders")
  public ResponseEntity<OrderService.Checkout> create(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody CheckoutRequest request) {
    OrderService.Checkout result =
        orders.create(
            auth.requireCustomer(authorization),
            new OrderService.CheckoutRequest(
                request.deliveryAddress(),
                request.paymentMethod(),
                request.voucherCode(),
                request.items() == null
                    ? null
                    : request.items().stream()
                        .map(
                            i ->
                                new OrderService.RequestedItem(
                                    i.productId(), i.quantity(), i.size(), i.color()))
                        .toList()));
    return ResponseEntity.status(HttpStatus.CREATED).body(result);
  }

  @GetMapping("/api/orders")
  public Page<OrderService.OrderView> history(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "ALL") String tab,
      @RequestParam(defaultValue = "") String keyword) {
    return orders.history(auth.requireCustomer(authorization), page, size, tab, keyword);
  }

  @GetMapping("/api/orders/{id}")
  public OrderService.OrderView detail(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id) {
    return orders.detail(auth.requireCustomer(authorization), id);
  }

  @GetMapping("/api/orders/{id}/payment")
  public OrderService.PaymentView payment(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id) {
    return orders.paymentDetails(auth.requireCustomer(authorization), id);
  }

  @PostMapping("/api/orders/{id}/payment/sync")
  public OrderService.PaymentView syncPayment(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id) {
    return orders.syncPayment(auth.requireCustomer(authorization), id);
  }

  @PostMapping("/api/orders/{id}/payment/retry")
  public OrderService.PaymentView retryPayment(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id) {
    return orders.retryPayment(auth.requireCustomer(authorization), id);
  }

  @PatchMapping("/api/orders/{id}/cancel")
  public OrderService.OrderView cancel(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id,
      @Valid @RequestBody(required = false) CancelRequest request) {
    return orders.cancel(
        auth.requireCustomer(authorization), id, request == null ? null : request.reason());
  }

  @PostMapping("/api/orders/{id}/return")
  public OrderService.OrderView requestReturn(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long id,
      @Valid @RequestBody ReturnRequest request) {
    return orders.requestReturn(auth.requireCustomer(authorization), id, request.reason());
  }

  @GetMapping("/api/payments/payos/return")
  public Map<String, Object> paymentReturn(
      @RequestParam(required = false) String code,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Long orderCode,
      @RequestParam(required = false) String paymentLinkId) {
    return Map.of(
        "code",
        Objects.toString(code, ""),
        "status",
        Objects.toString(status, ""),
        "orderCode",
        Objects.toString(orderCode, ""),
        "paymentLinkId",
        Objects.toString(paymentLinkId, ""),
        "message",
        "Đây chỉ là kết quả chuyển hướng hiển thị. Trạng thái đơn hàng được xác nhận qua webhook.");
  }

  @PostMapping("/api/payments/payos/webhook")
  public ResponseEntity<?> webhook(
      @RequestHeader(value = "x-payos-signature", required = false) String signature,
      @RequestBody JsonNode payload) {
    String supplied =
        signature == null || signature.isBlank() ? payload.path("signature").asText("") : signature;
    orders.webhook(payload, supplied);
    return ResponseEntity.ok(Map.of("success", true));
  }

  public record CheckoutRequest(
      @NotBlank @Size(max = 1000) String deliveryAddress,
      String paymentMethod,
      @Size(max = 40) String voucherCode,
      List<LineRequest> items) {}

  public record LineRequest(
      @NotNull Long productId, @Min(1) int quantity, String size, String color) {}

  public record CancelRequest(@Size(max = 1000) String reason) {}

  public record ReturnRequest(@NotBlank @Size(max = 1000) String reason) {}
}
