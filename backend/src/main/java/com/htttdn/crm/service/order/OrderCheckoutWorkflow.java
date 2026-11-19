package com.htttdn.crm.service.order;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;

import java.math.*;
import java.time.*;
import java.util.*;
import com.htttdn.crm.service.*;
import com.htttdn.crm.service.OrderService.*;

public final class OrderCheckoutWorkflow {
    private static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("399000.00");
    private static final BigDecimal SHIPPING_FEE = new BigDecimal("30000.00");
    private final OrderRepository orders;
    private final ProductRepository products;
    private final CartItemRepository carts;
    private final PaymentRepository payments;
    private final VoucherService vouchers;
    private final NotificationService notifications;
    private final PayosService payos;
    private final StockService stock;
    private final OrderPaymentWorkflow orderPaymentWorkflow;
    public OrderCheckoutWorkflow(OrderRepository orders, ProductRepository products, CartItemRepository carts, PaymentRepository payments, VoucherService vouchers, NotificationService notifications, PayosService payos, StockService stock, OrderPaymentWorkflow orderPaymentWorkflow) {
        this.orders = orders;
        this.products = products;
        this.carts = carts;
        this.payments = payments;
        this.vouchers = vouchers;
        this.notifications = notifications;
        this.payos = payos;
        this.stock = stock;
        this.orderPaymentWorkflow = orderPaymentWorkflow;
    }

    public Checkout create(User customer, CheckoutRequest request) {
        if (request.deliveryAddress() == null || request.deliveryAddress().isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CART", "Vui lòng nhập địa chỉ giao hàng.");
        String method = request.paymentMethod() == null ? "PAYOS" : request.paymentMethod().toUpperCase(Locale.ROOT);
        if (!Set.of("PAYOS", "COD").contains(method)) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAYMENT_METHOD", "Phương thức thanh toán không hợp lệ.");
        List<RequestedItem> requested = request.items() != null ? request.items() : carts.findByCustomerIdOrderByIdAsc(customer.getId()).stream().map(i -> new RequestedItem(i.getProduct().getId(), i.getQuantity(), i.getSize(), i.getColor())).toList();
        if (requested.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CART", "Giỏ hàng đang trống.");
        Map<CartLineKey, RequestedItem> grouped = new LinkedHashMap<>();
        for (RequestedItem line : requested) {
            if (line == null || line.productId() == null || line.quantity() < 1) throw OrderInput.invalidCart();
            var key = new CartLineKey(line.productId(), OrderInput.clean(line.size()), OrderInput.clean(line.color()));
            var previous = grouped.get(key);
            long quantity = (long) line.quantity() + (previous == null ? 0 : previous.quantity());
            if (quantity > Integer.MAX_VALUE) throw OrderInput.invalidCart();
            grouped.put(key, new RequestedItem(key.productId(), (int) quantity, key.size(), key.color()));
        }
        requested = grouped.values().stream().sorted(Comparator.comparing(RequestedItem::productId)).toList();
        Instant now = Instant.now(); Order order = new Order(); order.setCustomer(customer); order.setOrderCode(nextCode()); order.setDeliveryAddress(request.deliveryAddress().trim()); order.setPaymentMethod(method); order.setCreatedAt(now); order.setUpdatedAt(now); order.setStatus("PENDING"); order.setPaymentStatus("COD".equals(method) ? "COD" : "PENDING"); order.setExpiresAt("COD".equals(method) ? null : now.plus(Duration.ofMinutes(15)));
        BigDecimal subtotal = BigDecimal.ZERO;
        for (RequestedItem line : requested) {
            if (line == null || line.productId() == null || line.quantity() < 1) throw OrderInput.invalidCart();
            Product product = stock.lockProduct(line.productId()).filter(Product::isActive).orElseThrow(OrderInput::invalidCart); OrderInput.validateVariant(product, line.size(), line.color());
            if (line.quantity() > product.getStock()) throw new ApiException(HttpStatus.CONFLICT, "OUT_OF_STOCK", "Sản phẩm " + product.getName() + " không đủ số lượng.");
            product.setStock(product.getStock() - line.quantity()); product.setUpdatedAt(now); products.save(product);
            OrderItem item = new OrderItem(); item.setOrder(order); item.setProduct(product); item.setQuantity(line.quantity()); item.setSize(OrderInput.clean(line.size())); item.setColor(OrderInput.clean(line.color())); item.setUnitPrice(CartService.price(product)); order.getItems().add(item);
            subtotal = subtotal.add(item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
        }
        BigDecimal discount = BigDecimal.ZERO;
        StoreVoucher applied = null;
        if (request.voucherCode() != null && !request.voucherCode().isBlank()) { applied = vouchers.reserve(request.voucherCode(), subtotal, order); discount = order.getDiscountAmount(); }
        BigDecimal merchandiseAfterDiscount = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal shippingFee = merchandiseAfterDiscount.compareTo(FREE_SHIPPING_THRESHOLD) < 0 ? SHIPPING_FEE : BigDecimal.ZERO;
        order.setDiscountAmount(discount); order.setShippingFee(shippingFee);
        order.setTotalAmount(merchandiseAfterDiscount.add(shippingFee));
        if ("PAYOS".equals(method) && order.getTotalAmount().signum() > 0) payos.requireConfigured();
        orders.save(order);
        stock.recordSaleReservation(order, new AuditTrail.Actor(customer.getId(), customer.getFullName(), "CUSTOMER"));
        if(applied!=null) vouchers.record(order,applied);
        // Consume only purchased variants; keep unselected lines and any remaining quantity.
        Map<CartLineKey, Integer> remainingPurchase = new HashMap<>();
        grouped.forEach((key, line) -> remainingPurchase.put(key, line.quantity()));
        for (CartItem cartItem : carts.findByCustomerIdOrderByIdAsc(customer.getId())) {
            var key = new CartLineKey(cartItem.getProduct().getId(), OrderInput.clean(cartItem.getSize()), OrderInput.clean(cartItem.getColor()));
            int purchased = remainingPurchase.getOrDefault(key, 0);
            if (purchased == 0) continue;
            int consumed = Math.min(purchased, cartItem.getQuantity());
            remainingPurchase.put(key, purchased - consumed);
            if (consumed == cartItem.getQuantity()) carts.delete(cartItem);
            else { cartItem.setQuantity(cartItem.getQuantity() - consumed); carts.save(cartItem); }
        }
        notifications.create(customer, "Đặt hàng thành công", "Đơn hàng #" + order.getOrderCode() + " đã được ghi nhận.", "ORDER_CREATED", order.getId());
        Payment payment = new Payment(); payment.setOrder(order); payment.setAmount(order.getTotalAmount()); payment.setExpiresAt(order.getExpiresAt());
        if (order.getTotalAmount().signum()==0) { payment.setStatus("PAID"); order.setPaymentStatus("PAID"); payments.save(payment); return new Checkout(OrderViewMapper.view(order), null, null, null, null); }
        if ("COD".equals(method)) { payment.setStatus("PENDING"); payments.save(payment); return new Checkout(OrderViewMapper.view(order), null, null, null, null); }
        PayosService.Link link = payos.createPaymentLink(order); payment.setPaymentLinkId(link.paymentLinkId()); payment.setCheckoutUrl(link.checkoutUrl()); payment.setQrCode(link.qrCode()); payments.save(payment);
        orderPaymentWorkflow.saveAttempt(order, order.getOrderCode(), link, order.getExpiresAt());
        return new Checkout(OrderViewMapper.view(order), link.checkoutUrl(), link.paymentLinkId(), link.qrCode(), order.getExpiresAt());
    }

    public long nextCode() { long code = 100000000000L + (System.currentTimeMillis() % 89999999999L); while (orders.findByOrderCode(code).isPresent()) code++; return code; }
    private record CartLineKey(Long productId, String size, String color) {}

}
