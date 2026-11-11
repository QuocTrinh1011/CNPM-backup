package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReturnManagementService extends AdminServiceSupport {
  private final OrderRepository orders;
  private final OrderReturnEventRepository events;
  private final UserRepository users;
  private final JwtTokenService jwt;
  private final NotificationService notifications;

  public ReturnManagementService(
      OrderRepository orders,
      OrderReturnEventRepository events,
      UserRepository users,
      JwtTokenService jwt,
      NotificationService notifications) {
    this.orders = orders;
    this.events = events;
    this.users = users;
    this.jwt = jwt;
    this.notifications = notifications;
  }

  @Transactional
  public Order process(String authorization, Long id, Request input) {
    var claims = jwt.parse(authorization);
    User manager =
        users
            .findById(claims.userId())
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Phiên không hợp lệ."));
    if (!"MANAGER".equals(claims.role())
        || !"MANAGER".equals(manager.getRole())
        || manager.isLocked()
        || manager.getDeletedAt() != null)
      throw new ApiException(
          HttpStatus.FORBIDDEN, "MANAGER_REQUIRED", "Chỉ quản lý được xử lý đổi trả.");
    String status = input.status(), note = input.note() == null ? "" : input.note().trim();
    if (status == null
        || !Set.of("APPROVED", "REJECTED", "COMPLETED").contains(status)
        || note.length() > 1000
        || (!"APPROVED".equals(status) && note.isEmpty()))
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "INVALID_RETURN_ACTION",
          "Chọn thao tác hợp lệ; lý do từ chối hoặc ghi chú hoàn tất là bắt buộc, tối đa 1.000 ký"
              + " tự.");
    Order order =
        orders
            .findForStatusUpdate(id)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng."));
    if (!Set.of("DELIVERED", "COMPLETED").contains(order.getStatus())) throw conflict();
    if (status.equals(order.getReturnStatus())) {
      var last =
          order.getReturnHistory().stream()
              .filter(e -> status.equals(e.getStatus()))
              .reduce((a, b) -> b);
      if (last.isPresent() && last.get().getNote().equals(note)) return order;
      throw conflict();
    }
    boolean valid =
        "REQUESTED".equals(order.getReturnStatus())
                && Set.of("APPROVED", "REJECTED").contains(status)
            || "APPROVED".equals(order.getReturnStatus()) && "COMPLETED".equals(status);
    if (!valid) throw conflict();
    var before = snapshot(order);
    order.setReturnStatus(status);
    order.setUpdatedAt(Instant.now());
    OrderReturnEvent event = events.save(new OrderReturnEvent(order, manager, status, note));
    order.getReturnHistory().add(event);
    String label =
        switch (status) {
          case "APPROVED" -> "Yêu cầu đổi trả đã được chấp thuận";
          case "REJECTED" -> "Yêu cầu đổi trả đã bị từ chối";
          default -> "Đổi trả đã xử lý hoàn tất";
        };
    notifications.create(
        order.getCustomer(),
        label,
        "Đơn #" + order.getOrderCode() + ": " + label + (note.isEmpty() ? "" : ". " + note),
        "RETURN_" + status,
        id);
    audit("RETURN_PROCESS", "ORDER", id, before, order);
    return orders.save(order);
  }

  private ApiException conflict() {
    return new ApiException(
        HttpStatus.CONFLICT,
        "INVALID_RETURN_TRANSITION",
        "Yêu cầu đổi trả đã thay đổi hoặc không đủ điều kiện. Vui lòng tải lại.");
  }

  public record Request(@Size(max = 30) String status, @Size(max = 1000) String note) {}
}
