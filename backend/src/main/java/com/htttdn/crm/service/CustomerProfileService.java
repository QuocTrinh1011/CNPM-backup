package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only projections: never serialize customer entities or survey answers. */
@Service
@Transactional(readOnly = true)
public class CustomerProfileService {
  private final JdbcTemplate db;

  public CustomerProfileService(JdbcTemplate db) {
    this.db = db;
  }

  public record Customer(
      Long id,
      String fullName,
      String email,
      String phone,
      Integer age,
      String preferences,
      Instant createdAt,
      boolean locked,
      String lockReason) {}

  public record Summary(
      long totalOrders,
      long completedOrders,
      long cancelledOrders,
      long returnOrders,
      BigDecimal completedValue,
      Instant lastCompletedOrderAt) {}

  public record Profile(
      Customer customer, Summary summary, CustomerLifecycle.Segment segmentation) {}

  public record Page<T>(
      List<T> content, long totalElements, long totalPages, int number, int size) {}

  public record Address(
      long id,
      String label,
      String recipientName,
      String phone,
      String addressLine,
      String ward,
      String district,
      String province,
      boolean defaultAddress) {}

  public record OrderRow(
      long id,
      long orderCode,
      Instant createdAt,
      BigDecimal totalAmount,
      String status,
      String paymentStatus,
      String paymentMethod,
      String returnStatus) {}

  public record FeedbackRow(
      long id,
      String productName,
      int rating,
      String comment,
      String adminResponse,
      String status,
      boolean hidden,
      Instant createdAt) {}

  public record SurveyRow(
      long id, String title, Instant createdAt, boolean deleted, boolean rewarded) {}

  public record VoucherRow(
      long id,
      String code,
      String description,
      String discountType,
      BigDecimal discountValue,
      BigDecimal minOrderAmount,
      BigDecimal maxDiscountAmount,
      Instant startsAt,
      Instant expiresAt,
      String status) {}

  public record UsageRow(
      long orderId,
      long orderCode,
      String code,
      BigDecimal discountAmount,
      String orderStatus,
      Instant createdAt,
      String releaseStatus) {}

  private static Instant instant(ResultSet row, String name) throws SQLException {
    var value = row.getTimestamp(name);
    return value == null ? null : value.toInstant();
  }

  private Customer customer(long id) {
    var rows =
        db.query(
            "select customer_id,full_name,email,phone,age,preferences,created_at,locked,lock_reason"
                + " from customers where customer_id=? and role='CUSTOMER' and deleted_at is null",
            (r, n) ->
                new Customer(
                    r.getLong("customer_id"),
                    r.getString("full_name"),
                    r.getString("email"),
                    r.getString("phone"),
                    r.getObject("age") == null ? null : r.getInt("age"),
                    r.getString("preferences"),
                    instant(r, "created_at"),
                    r.getBoolean("locked"),
                    r.getString("lock_reason")),
            id);
    if (rows.isEmpty())
      throw new ApiException(
          HttpStatus.NOT_FOUND, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.");
    return rows.getFirst();
  }

  public Profile profile(long id) {
    Customer customer = customer(id);
    Summary summary =
        db.queryForObject(
            """
            select count(*) total_orders,
              coalesce(sum(case when status='COMPLETED' then 1 else 0 end),0) completed_orders,
              coalesce(sum(case when status='CANCELLED' then 1 else 0 end),0) cancelled_orders,
              coalesce(sum(case when coalesce(return_status,'NONE')<>'NONE' then 1 else 0 end),0) return_orders,
              coalesce(sum(case when status='COMPLETED' then total_amount else 0 end),0) completed_value,
              max(case when status='COMPLETED' then created_at end) last_completed_order_at
            from orders where customer_id=?
            """,
            (r, n) ->
                new Summary(
                    r.getLong("total_orders"),
                    r.getLong("completed_orders"),
                    r.getLong("cancelled_orders"),
                    r.getLong("return_orders"),
                    r.getBigDecimal("completed_value"),
                    instant(r, "last_completed_order_at")),
            id);
    return new Profile(
        customer,
        summary,
        CustomerLifecycle.calculate(
            summary.completedOrders(),
            summary.completedValue(),
            summary.lastCompletedOrderAt(),
            java.time.LocalDate.now(CustomerLifecycle.ZONE)));
  }

  private <T> Page<T> page(
      long id, int page, int size, String select, String from, String order, RowMapper<T> mapper) {
    customer(id);
    if (page < 0 || size < 1 || size > 100)
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "Phân trang không hợp lệ.");
    long count = db.queryForObject("select count(*) " + from, Long.class, id);
    var content =
        db.query(
            "select " + select + " " + from + " order by " + order + " limit ? offset ?",
            mapper,
            id,
            size,
            (long) page * size);
    return new Page<>(content, count, (count + size - 1) / size, page, size);
  }

  public Page<Address> addresses(long id, int page, int size) {
    return page(
        id,
        page,
        size,
        "a.id,a.label,a.recipient_name,a.phone,a.address_line,a.ward,a.district,a.province,a.default_address",
        "from customer_addresses a where a.customer_id=?",
        "a.default_address desc,a.id desc",
        (r, n) ->
            new Address(
                r.getLong("id"),
                r.getString("label"),
                r.getString("recipient_name"),
                r.getString("phone"),
                r.getString("address_line"),
                r.getString("ward"),
                r.getString("district"),
                r.getString("province"),
                r.getBoolean("default_address")));
  }

  public Page<OrderRow> orders(long id, int page, int size) {
    return page(
        id,
        page,
        size,
        "o.order_id,o.order_code,o.created_at,o.total_amount,o.status,o.payment_status,o.payment_method,o.return_status",
        "from orders o where o.customer_id=?",
        "o.created_at desc,o.order_id desc",
        (r, n) ->
            new OrderRow(
                r.getLong("order_id"),
                r.getLong("order_code"),
                instant(r, "created_at"),
                r.getBigDecimal("total_amount"),
                r.getString("status"),
                r.getString("payment_status"),
                r.getString("payment_method"),
                r.getString("return_status")));
  }

  public Page<FeedbackRow> feedback(long id, int page, int size) {
    return page(
        id,
        page,
        size,
        "f.feedback_id,p.name,f.rating,f.content,f.admin_response,f.status,f.hidden,f.created_at",
        "from feedback f join products p on p.product_id=f.product_id where f.customer_id=? and"
            + " f.deleted_at is null",
        "f.created_at desc,f.feedback_id desc",
        (r, n) ->
            new FeedbackRow(
                r.getLong("feedback_id"),
                r.getString("name"),
                r.getInt("rating"),
                r.getString("content"),
                r.getString("admin_response"),
                r.getString("status"),
                r.getBoolean("hidden"),
                instant(r, "created_at")));
  }

  public Page<SurveyRow> surveys(long id, int page, int size) {
    return page(
        id,
        page,
        size,
        "s.id,s.title,s.deleted_at,r.created_at,exists(select 1 from store_vouchers v where"
            + " v.owner_customer_id=r.customer_id and v.reward_survey_id=r.survey_id) rewarded",
        "from survey_responses r join survey_definitions s on s.id=r.survey_id where"
            + " r.customer_id=?",
        "r.created_at desc,r.id desc",
        (r, n) ->
            new SurveyRow(
                r.getLong("id"),
                r.getString("title"),
                instant(r, "created_at"),
                r.getTimestamp("deleted_at") != null,
                r.getBoolean("rewarded")));
  }

  public Page<VoucherRow> vouchers(long id, int page, int size) {
    Instant now = Instant.now();
    return page(
        id,
        page,
        size,
        "v.id,v.code,v.description,v.discount_type,v.discount_value,v.min_order_amount,v.max_discount_amount,v.starts_at,v.expires_at,v.active,v.usage_limit,v.used_count",
        "from store_vouchers v where v.owner_customer_id=?",
        "v.id desc",
        (r, n) -> {
          Instant start = instant(r, "starts_at"), end = instant(r, "expires_at");
          String status =
              !r.getBoolean("active")
                  ? "DISABLED"
                  : r.getObject("usage_limit") != null
                          && r.getInt("used_count") >= r.getInt("usage_limit")
                      ? "USED"
                      : end != null && !end.isAfter(now)
                          ? "EXPIRED"
                          : start != null && start.isAfter(now) ? "UPCOMING" : "AVAILABLE";
          return new VoucherRow(
              r.getLong("id"),
              r.getString("code"),
              r.getString("description"),
              r.getString("discount_type"),
              r.getBigDecimal("discount_value"),
              r.getBigDecimal("min_order_amount"),
              r.getBigDecimal("max_discount_amount"),
              start,
              end,
              status);
        });
  }

  public Page<UsageRow> voucherUsages(long id, int page, int size) {
    return page(
        id,
        page,
        size,
        "o.order_id,o.order_code,o.voucher_code,o.discount_amount,o.status,o.created_at,u.id"
            + " usage_id,u.released_at",
        "from orders o left join voucher_usages u on u.order_id=o.order_id where o.customer_id=?"
            + " and o.voucher_code is not null and trim(o.voucher_code)<>''",
        "o.created_at desc,o.order_id desc",
        (r, n) ->
            new UsageRow(
                r.getLong("order_id"),
                r.getLong("order_code"),
                r.getString("voucher_code"),
                r.getBigDecimal("discount_amount"),
                r.getString("status"),
                instant(r, "created_at"),
                r.getObject("usage_id") == null
                    ? "UNKNOWN"
                    : r.getTimestamp("released_at") != null ? "RELEASED" : "COUNTED"));
  }
}
