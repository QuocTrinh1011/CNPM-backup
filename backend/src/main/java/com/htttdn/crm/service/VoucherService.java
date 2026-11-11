package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import java.math.*;
import java.time.Instant;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VoucherService {
  private final StoreVoucherRepository vouchers;
  private final VoucherUsageRepository usages;

  public VoucherService(StoreVoucherRepository vouchers, VoucherUsageRepository usages) {
    this.vouchers = vouchers;
    this.usages = usages;
  }

  public static String normalize(String code) {
    return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
  }

  public static String state(StoreVoucher v, Instant now) {
    if (!v.isActive()) return "DISABLED";
    if (v.getExpiresAt() != null && !now.isBefore(v.getExpiresAt())) return "EXPIRED";
    if (v.getStartsAt() != null && now.isBefore(v.getStartsAt())) return "SCHEDULED";
    if (v.getUsageLimit() != null && v.getUsedCount() >= v.getUsageLimit()) return "EXHAUSTED";
    return "ACTIVE";
  }

  @Transactional(readOnly = true)
  public Preview preview(String code, BigDecimal amount) {
    return preview(code, amount, null);
  }

  @Transactional(readOnly = true)
  public Preview preview(String code, BigDecimal amount, Long customerId) {
    StoreVoucher v =
        vouchers.findByCodeIgnoreCase(normalize(code)).orElseThrow(VoucherService::notFound);
    checkOwner(v, customerId);
    check(v, amount);
    long used = checkCustomerLimit(v, customerId);
    return new Preview(
        v.getCode(),
        v.getDiscountType(),
        v.getDiscountValue(),
        discount(v, amount),
        v.getMinOrderAmount(),
        v.getExpiresAt(),
        v.getMaxDiscountAmount(),
        v.getDescription(),
        customerLimit(v),
        customerId == null ? null : used,
        remaining(v, used));
  }

  // Called inside checkout's transaction; lock is retained through order/payment creation.
  @Transactional
  public StoreVoucher reserve(String code, BigDecimal amount, Order order) {
    StoreVoucher v = vouchers.lockByCode(normalize(code)).orElseThrow(VoucherService::notFound);
    checkOwner(v, order.getCustomer() == null ? null : order.getCustomer().getId());
    check(v, amount);
    checkCustomerLimit(v, order.getCustomer() == null ? null : order.getCustomer().getId());
    v.setUsedCount(Math.addExact(v.getUsedCount(), 1));
    vouchers.save(v);
    order.setVoucherCode(v.getCode());
    order.setDiscountAmount(discount(v, amount));
    return v;
  }

  @Transactional
  public void record(Order order, StoreVoucher v) {
    usages.save(new VoucherUsage(order, v));
  }

  // All callers must first lock the order, so repeated/concurrent cancellation releases once.
  @Transactional
  public void release(Order order) {
    usages
        .findByOrderId(order.getId())
        .ifPresent(
            usage -> {
              if (usage.getReleasedAt() != null) return;
              StoreVoucher v =
                  vouchers
                      .lockById(usage.getVoucher().getId())
                      .orElseThrow(VoucherService::notFound);
              if (v.getUsedCount() <= 0)
                throw new IllegalStateException("Voucher usage counter is inconsistent");
              v.setUsedCount(v.getUsedCount() - 1);
              vouchers.save(v);
              usage.setReleasedAt(Instant.now());
              usages.save(usage);
            });
  }

  private static void checkOwner(StoreVoucher v, Long customerId) {
    if (v.getOwnerCustomerId() != null && !v.getOwnerCustomerId().equals(customerId))
      throw notFound();
  }

  public static Integer customerLimit(StoreVoucher v) {
    if (v.getOwnerCustomerId() != null) return Integer.valueOf(1);
    return v.getPerCustomerLimit();
  }

  public static Long remaining(StoreVoucher v, long used) {
    Integer limit = customerLimit(v);
    return limit == null ? null : Math.max(0L, (long) limit - used);
  }

  private long checkCustomerLimit(StoreVoucher v, Long id) {
    Integer limit = customerLimit(v);
    if (limit != null && id == null)
      throw new ApiException(
          HttpStatus.UNAUTHORIZED,
          "VOUCHER_LOGIN_REQUIRED",
          "Vui lòng đăng nhập để kiểm tra lượt sử dụng voucher.");
    long used = id == null ? 0 : usages.countActive(v.getId(), id);
    if (limit != null && used >= limit)
      throw bad("VOUCHER_PER_CUSTOMER_LIMIT", "Bạn đã dùng hết lượt của mã này.");
    return used;
  }

  public static void check(StoreVoucher v, BigDecimal amount) {
    if (amount == null
        || amount.signum() < 0
        || amount.compareTo(new BigDecimal("9999999999999.99")) > 0)
      throw bad("VOUCHER_AMOUNT_INVALID", "Giá trị đơn hàng không hợp lệ.");
    String state = state(v, Instant.now());
    if (!"ACTIVE".equals(state))
      throw bad(
          "VOUCHER_" + state,
          switch (state) {
            case "SCHEDULED" -> "Mã giảm giá chưa đến thời gian sử dụng.";
            case "EXPIRED" -> "Mã giảm giá đã hết hạn.";
            case "EXHAUSTED" -> "Mã giảm giá đã hết lượt sử dụng.";
            default -> "Mã giảm giá đã ngừng áp dụng.";
          });
    if (amount.compareTo(v.getMinOrderAmount()) < 0)
      throw bad(
          "VOUCHER_MINIMUM_NOT_MET",
          "Đơn hàng cần đạt tối thiểu "
              + v.getMinOrderAmount().toPlainString()
              + " đ để dùng mã này.");
  }

  public static BigDecimal discount(StoreVoucher v, BigDecimal amount) {
    BigDecimal result;
    if ("FIXED_AMOUNT".equals(v.getDiscountType())) result = v.getDiscountValue();
    else if ("PERCENTAGE".equals(v.getDiscountType())) {
      result =
          amount
              .multiply(v.getDiscountValue())
              .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
      if (v.getMaxDiscountAmount() != null) result = result.min(v.getMaxDiscountAmount());
    } else throw bad("VOUCHER_INVALID", "Loại mã giảm giá không hợp lệ.");
    return result
        .setScale(0, RoundingMode.HALF_UP)
        .min(amount.setScale(0, RoundingMode.DOWN))
        .max(BigDecimal.ZERO);
  }

  public static ApiException bad(String code, String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, message);
  }

  public static ApiException notFound() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "VOUCHER_NOT_FOUND", "Không tìm thấy mã giảm giá.");
  }

  public record Preview(
      String code,
      String discountType,
      BigDecimal discountValue,
      BigDecimal discountAmount,
      BigDecimal minOrderAmount,
      Instant expiresAt,
      BigDecimal maxDiscountAmount,
      String description,
      Integer perCustomerLimit,
      Long customerUses,
      Long customerRemaining) {}
}
