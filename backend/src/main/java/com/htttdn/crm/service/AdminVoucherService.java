package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.htttdn.crm.entity.StoreVoucher;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminVoucherService extends AdminServiceSupport {
  private final StoreVoucherRepository vouchers;
  private final OrderRepository orders;
  private final ObjectMapper mapper;
  private static final Set<String> FIELDS =
      Set.of(
          "code",
          "description",
          "discountType",
          "discountValue",
          "minOrderAmount",
          "maxDiscountAmount",
          "usageLimit",
          "startsAt",
          "expiresAt",
          "active",
          "perCustomerLimit");

  public AdminVoucherService(
      StoreVoucherRepository vouchers, OrderRepository orders, ObjectMapper mapper) {
    this.vouchers = vouchers;
    this.orders = orders;
    this.mapper = mapper;
  }

  @Transactional(readOnly = true)
  public Page<View> list(String search, String state, int page, int size) {
    if (page < 0 || size < 1 || size > 100) throw invalid("Phân trang không hợp lệ.");
    if (state != null
        && !state.isBlank()
        && !Set.of("ACTIVE", "DISABLED", "EXPIRED", "SCHEDULED", "EXHAUSTED").contains(state))
      throw invalid("Trạng thái không hợp lệ.");
    Instant now = Instant.now();
    return vouchers
        .findAll(
            (root, query, cb) -> {
              List<Predicate> filters = new ArrayList<>();
              filters.add(cb.isNull(root.get("ownerCustomerId")));
              if (search != null && !search.isBlank()) {
                String term =
                    VoucherService.normalize(search)
                        .replace("!", "!!")
                        .replace("%", "!%")
                        .replace("_", "!_");
                filters.add(cb.like(cb.upper(root.get("code")), "%" + term + "%", '!'));
              }
              Predicate expired =
                  cb.and(
                      cb.isNotNull(root.get("expiresAt")),
                      cb.lessThanOrEqualTo(root.get("expiresAt"), now));
              Predicate started =
                  cb.or(
                      cb.isNull(root.get("startsAt")),
                      cb.lessThanOrEqualTo(root.get("startsAt"), now));
              Predicate available =
                  cb.or(
                      cb.isNull(root.get("usageLimit")),
                      cb.lessThan(root.get("usedCount"), root.get("usageLimit")));
              if (state != null && !state.isBlank())
                filters.add(
                    switch (state) {
                      case "DISABLED" -> cb.isFalse(root.get("active"));
                      case "EXPIRED" -> cb.and(cb.isTrue(root.get("active")), expired);
                      case "SCHEDULED" ->
                          cb.and(cb.isTrue(root.get("active")), cb.not(expired), cb.not(started));
                      case "EXHAUSTED" ->
                          cb.and(
                              cb.isTrue(root.get("active")),
                              cb.not(expired),
                              started,
                              cb.not(available));
                      default ->
                          cb.and(
                              cb.isTrue(root.get("active")), cb.not(expired), started, available);
                    });
              return cb.and(filters.toArray(Predicate[]::new));
            },
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")))
        .map(v -> view(v, now));
  }

  @Transactional
  public View create(Input input) {
    StoreVoucher v = new StoreVoucher();
    apply(v, input);
    if (vouchers.findByCodeIgnoreCase(v.getCode()).isPresent())
      throw new ApiException(HttpStatus.CONFLICT, "VOUCHER_DUPLICATE", "Mã giảm giá đã tồn tại.");
    vouchers.saveAndFlush(v);
    audit("CREATE", "VOUCHER", v.getId(), Map.of(), v);
    return view(v, Instant.now());
  }

  @Transactional
  public View createFromJson(JsonNode input) {
    if (input == null || !input.isObject()) throw invalid("Dữ liệu tạo mã không hợp lệ.");
    validateCustomerLimit(input);
    ObjectNode value = input.deepCopy();
    if (!value.has("perCustomerLimit")) value.put("perCustomerLimit", 1);
    Input parsed;
    try {
      parsed = mapper.treeToValue(value, Input.class);
    } catch (Exception ex) {
      throw invalid("Định dạng dữ liệu không hợp lệ.");
    }
    return create(parsed);
  }

  @Transactional
  public View update(Long id, JsonNode patch) {
    StoreVoucher v = vouchers.lockById(id).orElseThrow(VoucherService::notFound);
    var before = snapshot(v);
    if (v.getOwnerCustomerId() != null)
      throw invalid("Không được sửa mã thưởng đã cấp cho khách hàng.");
    if (patch == null || !patch.isObject()) throw invalid("Dữ liệu cập nhật không hợp lệ.");
    validateCustomerLimit(patch);
    ObjectNode merged = mapper.valueToTree(input(v));
    patch
        .fields()
        .forEachRemaining(
            entry -> {
              if (!FIELDS.contains(entry.getKey()))
                throw invalid("Trường không hợp lệ: " + entry.getKey());
              merged.set(entry.getKey(), entry.getValue());
            });
    Input next;
    try {
      next = mapper.treeToValue(merged, Input.class);
    } catch (Exception e) {
      throw invalid("Định dạng dữ liệu không hợp lệ.");
    }
    if (!VoucherService.normalize(v.getCode()).equals(VoucherService.normalize(next.code())))
      throw invalid("Không được đổi tên mã đã tạo.");
    String originalCode = v.getCode();
    apply(v, next);
    v.setCode(originalCode);
    vouchers.saveAndFlush(v);
    audit("UPDATE", "VOUCHER", id, before, v);
    return view(v, Instant.now());
  }

  public static void apply(StoreVoucher v, Input r) {
    if (r == null) throw invalid("Vui lòng nhập thông tin mã.");
    String code = VoucherService.normalize(r.code());
    if (!code.matches("[A-Z0-9_-]{1,40}"))
      throw invalid("Mã gồm 1–40 ký tự chữ Latin, số, gạch ngang hoặc gạch dưới.");
    if (r.discountType() == null
        || !Set.of("PERCENTAGE", "FIXED_AMOUNT").contains(r.discountType()))
      throw invalid("Loại giảm giá không hợp lệ.");
    if (!positive(r.discountValue()))
      throw invalid("Giá trị giảm phải lớn hơn 0 và tối đa 9.999.999.999,99.");
    if ("PERCENTAGE".equals(r.discountType())
        && r.discountValue().compareTo(BigDecimal.valueOf(100)) > 0)
      throw invalid("Phần trăm giảm không được vượt 100%.");
    BigDecimal minimum = r.minOrderAmount() == null ? BigDecimal.ZERO : r.minOrderAmount();
    if (minimum.signum() < 0
        || minimum.compareTo(new BigDecimal("9999999999.99")) > 0
        || minimum.stripTrailingZeros().scale() > 0)
      throw invalid("Đơn tối thiểu phải là số tiền nguyên không âm.");
    if ("FIXED_AMOUNT".equals(r.discountType())
        && r.discountValue().stripTrailingZeros().scale() > 0)
      throw invalid("Tiền giảm phải là số nguyên VND.");
    if (r.maxDiscountAmount() != null
        && (!positive(r.maxDiscountAmount())
            || r.maxDiscountAmount().stripTrailingZeros().scale() > 0))
      throw invalid("Mức giảm tối đa phải là số tiền nguyên dương.");
    if (r.usageLimit() != null && (r.usageLimit() < 1 || r.usageLimit() < v.getUsedCount()))
      throw invalid("Giới hạn lượt phải dương và không thấp hơn lượt đang tính.");
    if (r.startsAt() != null && r.expiresAt() != null && !r.expiresAt().isAfter(r.startsAt()))
      throw invalid("Ngày kết thúc phải sau ngày bắt đầu.");
    if (r.description() != null && r.description().length() > 1000)
      throw invalid("Mô tả tối đa 1.000 ký tự.");
    if (r.perCustomerLimit() != null && r.perCustomerLimit() < 1)
      throw invalid("Giới hạn mỗi khách phải là số nguyên dương hoặc để trống.");
    if (r.active() == null) throw invalid("Vui lòng chọn trạng thái bật/tắt.");
    v.setCode(code);
    v.setDescription(r.description() == null ? null : r.description().trim());
    v.setDiscountType(r.discountType());
    v.setDiscountValue(r.discountValue());
    v.setMinOrderAmount(minimum);
    v.setMaxDiscountAmount("PERCENTAGE".equals(r.discountType()) ? r.maxDiscountAmount() : null);
    v.setUsageLimit(r.usageLimit());
    v.setStartsAt(r.startsAt());
    v.setExpiresAt(r.expiresAt());
    v.setActive(r.active());
    v.setPerCustomerLimit(r.perCustomerLimit());
  }

  private static boolean positive(BigDecimal value) {
    return value != null
        && value.signum() > 0
        && value.compareTo(new BigDecimal("9999999999.99")) <= 0
        && value.stripTrailingZeros().scale() <= 2;
  }

  private static void validateCustomerLimit(JsonNode input) {
    var value = input.get("perCustomerLimit");
    if (value != null
        && !value.isNull()
        && (!value.isIntegralNumber() || !value.canConvertToInt() || value.intValue() < 1))
      throw invalid("Giới hạn mỗi khách phải là số nguyên dương hoặc null.");
  }

  private static ApiException invalid(String message) {
    return VoucherService.bad("VOUCHER_VALIDATION", message);
  }

  private Input input(StoreVoucher v) {
    return new Input(
        v.getCode(),
        v.getDescription(),
        v.getDiscountType(),
        v.getDiscountValue(),
        v.getMinOrderAmount(),
        v.getMaxDiscountAmount(),
        v.getUsageLimit(),
        v.getStartsAt(),
        v.getExpiresAt(),
        v.isActive(),
        v.getPerCustomerLimit());
  }

  private View view(StoreVoucher v, Instant now) {
    return new View(
        v.getId(),
        v.getCode(),
        v.getDescription(),
        v.getDiscountType(),
        v.getDiscountValue(),
        v.getMinOrderAmount(),
        v.getMaxDiscountAmount(),
        v.getUsageLimit(),
        v.getUsedCount(),
        v.getStartsAt(),
        v.getExpiresAt(),
        v.isActive(),
        VoucherService.state(v, now),
        orders.voucherSavings(v.getCode()),
        v.getPerCustomerLimit());
  }

  public record Input(
      String code,
      String description,
      String discountType,
      BigDecimal discountValue,
      BigDecimal minOrderAmount,
      BigDecimal maxDiscountAmount,
      Integer usageLimit,
      Instant startsAt,
      Instant expiresAt,
      Boolean active,
      Integer perCustomerLimit) {
    public Input(
        String code,
        String description,
        String discountType,
        BigDecimal discountValue,
        BigDecimal minOrderAmount,
        BigDecimal maxDiscountAmount,
        Integer usageLimit,
        Instant startsAt,
        Instant expiresAt,
        Boolean active) {
      this(
          code,
          description,
          discountType,
          discountValue,
          minOrderAmount,
          maxDiscountAmount,
          usageLimit,
          startsAt,
          expiresAt,
          active,
          null);
    }
  }

  public record View(
      Long id,
      String code,
      String description,
      String discountType,
      BigDecimal discountValue,
      BigDecimal minOrderAmount,
      BigDecimal maxDiscountAmount,
      Integer usageLimit,
      int usedCount,
      Instant startsAt,
      Instant expiresAt,
      boolean active,
      String state,
      BigDecimal totalDiscount,
      Integer perCustomerLimit) {}
}
