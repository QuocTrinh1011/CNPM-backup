package com.htttdn.crm.service;

import com.htttdn.crm.dto.admin.AdminDtos.StatusRequest;
import com.htttdn.crm.entity.Order;
import com.htttdn.crm.exception.ApiException;
import org.springframework.http.HttpStatus;
import com.htttdn.crm.repository.OrderRepository;
import com.htttdn.crm.repository.PaymentRepository;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Set;
import java.util.Map;

@Service
public class AdminOrderService extends AdminServiceSupport {
    private static final Set<String> STATUSES = Set.of("PENDING_PAYMENT", "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED");
    private static final Map<String, Integer> PROGRESS = Map.of("PENDING_PAYMENT", 0, "PENDING", 1, "CONFIRMED", 2, "PREPARING", 3, "SHIPPED", 4, "DELIVERING", 4, "DELIVERED", 5, "COMPLETED", 6);
    private static boolean canAdvance(String current, String next) {
        if ("COMPLETED".equals(next)) return false;
        if (next.equals(current)) return true;
        if ("CANCELLED".equals(next) && Set.of("SHIPPED", "DELIVERING").contains(current)) return false;
        if ("DELIVERED".equals(current)) return false;
        if ("DELIVERED".equals(next)) return Set.of("SHIPPED", "DELIVERING").contains(current);
        if ("PENDING_PAYMENT".equals(current)) return "CANCELLED".equals(next);
        if ("PENDING".equals(current)) return "CONFIRMED".equals(next) || "CANCELLED".equals(next);
        if ("CANCELLED".equals(current) || "COMPLETED".equals(current)) return false;
        if (!PROGRESS.containsKey(current)) return false;
        return "CANCELLED".equals(next) || PROGRESS.getOrDefault(next, -1) > PROGRESS.get(current);
    }
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final NotificationService notifications;
    private final VoucherService vouchers;
    private final StockService stock;
    @org.springframework.beans.factory.annotation.Autowired
    public AdminOrderService(OrderRepository orders, NotificationService notifications, VoucherService vouchers, PaymentRepository payments, StockService stock) { this.orders = orders; this.notifications = notifications; this.vouchers=vouchers; this.payments=payments; this.stock=stock; }
    public Page<Order> list(String status, int page, int size) {
        if (status != null && (status.equals("RETURN") || status.startsWith("RETURN_"))) {
            String returnStatus=status.equals("RETURN")?null:status.substring(7);
            if (returnStatus!=null && !Set.of("REQUESTED","APPROVED","REJECTED","COMPLETED").contains(returnStatus))
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_FILTER","Bộ lọc đổi trả không hợp lệ.");
            return orders.findAll((root,query,cb)->cb.and(cb.notEqual(root.get("status"),"CANCELLED"),returnStatus==null?cb.notEqual(cb.coalesce(root.<String>get("returnStatus"),"NONE"),"NONE"):cb.equal(root.get("returnStatus"),returnStatus)),page(page,size));
        }
        return status == null || status.isBlank() ? orders.findAll(page(page, size)) : orders.findByStatus(status, page(page, size));
    }
    public Order get(Long id) { return orders.findById(id).orElseThrow(); }
    @Transactional public Order updateStatus(Long id, StatusRequest request) {
        if (!STATUSES.contains(request.status())) throw new IllegalArgumentException("Invalid order status");
        String reason = request.reason() == null ? "" : request.reason().trim();
        if ("CANCELLED".equals(request.status()) && (reason.isEmpty() || reason.length() > 1000)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CANCEL_REASON_REQUIRED", "Vui lòng nhập lý do hủy đơn từ 1 đến 1.000 ký tự.");
        }
        Order order = orders.findForStatusUpdate(id).orElseThrow();
        if("CANCELLED".equals(request.status())&&order.paymentReviewRequired)throw new ApiException(HttpStatus.CONFLICT,"PAYMENT_NEEDS_REVIEW","Cần đối chiếu thanh toán trước khi hủy đơn.");
        var before=snapshot(order);
        if (order.getReturnStatus()!=null && !"NONE".equals(order.getReturnStatus()))
            throw new ApiException(HttpStatus.CONFLICT,"RETURN_IN_PROGRESS","Đơn có yêu cầu đổi trả; hãy dùng chức năng xử lý đổi trả.");
        if (!canAdvance(order.getStatus(), request.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_ORDER_TRANSITION", "Không thể chuyển ngược trạng thái hoặc cập nhật đơn đã hủy/hoàn thành. Vui lòng tải lại đơn hàng.");
        }
        if (request.status().equals(order.getStatus()) && !"CANCELLED".equals(request.status())) return order;
        if ("CANCELLED".equals(request.status())) {
            if ("CANCELLED".equals(order.getStatus()) && order.getCancelReason() != null && !order.getCancelReason().isBlank()) {
                if (reason.equals(order.getCancelReason())) return order;
                throw new ApiException(HttpStatus.CONFLICT, "CANCEL_REASON_ALREADY_SET", "Đơn hàng đã có lý do hủy, không thể ghi đè.");
            }
            if (!"CANCELLED".equals(order.getStatus())) { stock.release(order); vouchers.release(order); }
            if ("PAYOS".equals(order.getPaymentMethod()) && "PENDING".equals(order.getPaymentStatus())) {
                order.setPaymentStatus("CANCELLED");
                payments.findByOrderId(order.getId()).ifPresent(payment -> { payment.setStatus("CANCELLED"); payment.setUpdatedAt(Instant.now()); payments.save(payment); });
            }
            order.setCancelReason(reason);
            notifications.create(order.getCustomer(), "Đơn hàng đã bị hủy", "Đơn hàng #" + order.getOrderCode() + " đã bị hủy. Lý do: " + reason
                + ("PAID".equals(order.getPaymentStatus()) ? " Đơn đã thanh toán; hệ thống không tự xử lý khoản tiền đã thu. Vui lòng liên hệ cửa hàng để đối soát thủ công." : ""), "ORDER_CANCELLED", order.getId());
        }
        order.setStatus(request.status());
        order.setUpdatedAt(Instant.now());
        if (!"CANCELLED".equals(request.status())) notifications.create(order.getCustomer(), "Cập nhật đơn hàng", "Đơn #"+order.getOrderCode()+": "+switch(request.status()){case "CONFIRMED" -> "Đã xác nhận";case "PREPARING" -> "Đang xử lý";case "SHIPPED","DELIVERING" -> "Đang giao";case "DELIVERED" -> "Đã giao — chờ bạn xác nhận nhận hàng";default -> "Trạng thái đơn đã cập nhật";}, "ORDER_STATUS", order.getId());
        audit("ORDER_STATUS","ORDER",id,before,order);
        return orders.save(order);
    }
}
