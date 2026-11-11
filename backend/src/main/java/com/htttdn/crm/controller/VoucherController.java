package com.htttdn.crm.controller;

import com.htttdn.crm.entity.StoreVoucher;
import com.htttdn.crm.repository.StoreVoucherRepository;
import com.htttdn.crm.service.*;
import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.data.domain.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class VoucherController {
  private final VoucherService service;
  private final AuthService auth;
  private final StoreVoucherRepository vouchers;
  private final com.htttdn.crm.repository.VoucherUsageRepository usages;

  public VoucherController(
      VoucherService service,
      AuthService auth,
      StoreVoucherRepository vouchers,
      com.htttdn.crm.repository.VoucherUsageRepository usages) {
    this.service = service;
    this.auth = auth;
    this.vouchers = vouchers;
    this.usages = usages;
  }

  @GetMapping("/api/vouchers/validate")
  public VoucherService.Preview validate(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestParam String code,
      @RequestParam BigDecimal amount) {
    return service.preview(
        code, amount, authorization == null ? null : auth.requireCustomer(authorization).getId());
  }

  @GetMapping("/api/customers/me/vouchers")
  public Page<WalletView> mine(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Long id = auth.requireCustomer(authorization).getId();
    if (page < 0 || size < 1 || size > 100)
      throw VoucherService.bad("INVALID_PAGE", "Phân trang không hợp lệ.");
    var result =
        vouchers.findWallet(
            id, Instant.now(), PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));
    var counts = new java.util.HashMap<Long, Long>();
    if (!result.isEmpty())
      usages
          .customerCounts(result.stream().map(StoreVoucher::getId).toList(), id)
          .forEach(row -> counts.put(row.getVoucherId(), row.getUses()));
    return result.map(v -> view(v, counts.getOrDefault(v.getId(), 0L)));
  }

  public static WalletView view(StoreVoucher v) {
    return view(v, v.getOwnerCustomerId() != null ? v.getUsedCount() : 0L);
  }

  public static WalletView view(StoreVoucher v, long customerUses) {
    boolean personal = v.getOwnerCustomerId() != null;
    if (personal) customerUses = Math.max(customerUses, v.getUsedCount());
    Integer limit = VoucherService.customerLimit(v);
    boolean reached = limit != null && customerUses >= limit;
    String state =
        personal && v.getUsedCount() > 0 ? "USED" : VoucherService.state(v, Instant.now());
    return new WalletView(
        v.getCode(),
        v.getDescription(),
        v.getDiscountType(),
        v.getDiscountValue(),
        v.getMinOrderAmount(),
        v.getMaxDiscountAmount(),
        v.getExpiresAt(),
        state,
        personal ? "SURVEY" : "GENERAL",
        limit,
        customerUses,
        VoucherService.remaining(v, customerUses),
        "ACTIVE".equals(state) && !reached,
        reached
            ? "VOUCHER_PER_CUSTOMER_LIMIT"
            : !"ACTIVE".equals(state) ? "VOUCHER_" + state : null);
  }

  public record WalletView(
      String code,
      String description,
      String discountType,
      BigDecimal discountValue,
      BigDecimal minOrderAmount,
      BigDecimal maxDiscountAmount,
      Instant expiresAt,
      String state,
      String source,
      Integer perCustomerLimit,
      long customerUses,
      Long customerRemaining,
      boolean selectable,
      String unavailableReason) {}
}
