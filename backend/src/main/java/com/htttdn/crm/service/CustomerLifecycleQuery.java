package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CustomerLifecycleQuery {
  private final JdbcTemplate db;

  public CustomerLifecycleQuery(JdbcTemplate db) {
    this.db = db;
  }

  public record Filters(
      String q,
      String stage,
      Boolean dormant,
      Long minCompletedOrders,
      Long maxCompletedOrders,
      BigDecimal minCompletedValue,
      BigDecimal maxCompletedValue,
      LocalDate lastPurchaseFrom,
      LocalDate lastPurchaseTo,
      String sort,
      String direction,
      int page,
      int size,
      BigDecimal minRating,
      BigDecimal maxRating,
      Boolean surveyed,
      Long surveyId) {
    public Filters(
        String q,
        String stage,
        Boolean dormant,
        Long minCompletedOrders,
        Long maxCompletedOrders,
        BigDecimal minCompletedValue,
        BigDecimal maxCompletedValue,
        LocalDate lastPurchaseFrom,
        LocalDate lastPurchaseTo,
        String sort,
        String direction,
        int page,
        int size,
        BigDecimal minRating,
        BigDecimal maxRating,
        Boolean surveyed) {
      this(
          q,
          stage,
          dormant,
          minCompletedOrders,
          maxCompletedOrders,
          minCompletedValue,
          maxCompletedValue,
          lastPurchaseFrom,
          lastPurchaseTo,
          sort,
          direction,
          page,
          size,
          minRating,
          maxRating,
          surveyed,
          null);
    }

    public Filters(
        String q,
        String stage,
        Boolean dormant,
        Long minCompletedOrders,
        Long maxCompletedOrders,
        BigDecimal minCompletedValue,
        BigDecimal maxCompletedValue,
        LocalDate lastPurchaseFrom,
        LocalDate lastPurchaseTo,
        String sort,
        String direction,
        int page,
        int size) {
      this(
          q,
          stage,
          dormant,
          minCompletedOrders,
          maxCompletedOrders,
          minCompletedValue,
          maxCompletedValue,
          lastPurchaseFrom,
          lastPurchaseTo,
          sort,
          direction,
          page,
          size,
          null,
          null,
          null);
    }
  }

  public record Customer(
      long id,
      String fullName,
      String email,
      String phone,
      Integer age,
      String preferences,
      Instant createdAt,
      boolean locked,
      String lockReason,
      long completedOrders,
      BigDecimal completedValue,
      Instant lastCompletedOrderAt,
      CustomerLifecycle.Segment segmentation) {}

  private static ApiException invalid(String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CUSTOMER_FILTER", message);
  }

  private static final Map<String, String> SORTS =
      Map.of(
          "createdAt",
          "created_at",
          "completedOrders",
          "completed_orders",
          "completedValue",
          "completed_value",
          "lastPurchaseAt",
          "last_completed_order_at");

  public CustomerProfileService.Page<Customer> list(Filters f) {
    return list(f, LocalDate.now(CustomerLifecycle.ZONE));
  }

  private record Matching(String cte, StringBuilder where, List<Object> args) {}

  private Matching matching(Filters f, LocalDate today) {
    if (f.page() < 0 || f.size() < 1 || f.size() > 100) throw invalid("Phân trang không hợp lệ.");
    if (f.q() != null && f.q().length() > 255) throw invalid("Từ khóa tối đa 255 ký tự.");
    if (f.stage() != null
        && !Set.of("NO_PURCHASE", "FIRST_PURCHASE", "RETURNING", "LOYAL").contains(f.stage()))
      throw invalid("Nhóm khách hàng không hợp lệ.");
    if (!SORTS.containsKey(f.sort()) || !Set.of("asc", "desc").contains(f.direction()))
      throw invalid("Sắp xếp không hợp lệ.");
    if (f.minCompletedOrders() != null && f.minCompletedOrders() < 0
        || f.maxCompletedOrders() != null && f.maxCompletedOrders() < 0
        || f.minCompletedOrders() != null
            && f.maxCompletedOrders() != null
            && f.minCompletedOrders() > f.maxCompletedOrders())
      throw invalid("Khoảng số đơn không hợp lệ.");
    if (f.minCompletedValue() != null && f.minCompletedValue().signum() < 0
        || f.maxCompletedValue() != null && f.maxCompletedValue().signum() < 0
        || f.minCompletedValue() != null
            && f.maxCompletedValue() != null
            && f.minCompletedValue().compareTo(f.maxCompletedValue()) > 0)
      throw invalid("Khoảng giá trị không hợp lệ.");
    if (f.lastPurchaseFrom() != null
        && f.lastPurchaseTo() != null
        && f.lastPurchaseFrom().isAfter(f.lastPurchaseTo()))
      throw invalid("Khoảng ngày mua không hợp lệ.");
    for (var rating : new BigDecimal[] {f.minRating(), f.maxRating()})
      if (rating != null
          && (rating.compareTo(BigDecimal.ONE) < 0 || rating.compareTo(BigDecimal.valueOf(5)) > 0))
        throw invalid("Điểm đánh giá phải từ 1 đến 5.");
    if (f.minRating() != null
        && f.maxRating() != null
        && f.minRating().compareTo(f.maxRating()) > 0)
      throw invalid("Khoảng điểm đánh giá không hợp lệ.");
    if (f.surveyId() != null) surveyOption(f.surveyId());
    String cte = metricsCte();
    StringBuilder where = new StringBuilder(" where 1=1");
    List<Object> args = new ArrayList<>();
    if (f.q() != null && !f.q().isBlank()) {
      where.append(
          " and (lower(full_name) like ? escape '!' or lower(email) like ? escape '!' or"
              + " lower(phone) like ? escape '!')");
      String q =
          "%"
              + f.q()
                  .trim()
                  .toLowerCase(Locale.ROOT)
                  .replace("!", "!!")
                  .replace("%", "!%")
                  .replace("_", "!_")
              + "%";
      args.add(q);
      args.add(q);
      args.add(q);
    }
    conditions(f, today, where, args);
    return new Matching(cte, where, args);
  }

  static String metricsCte() {
    return """
    with purchases as (
      select customer_id,count(*) completed_orders,sum(total_amount) completed_value,max(created_at) last_completed_order_at
      from orders where status='COMPLETED' group by customer_id
    ), metrics as (
      select c.customer_id,c.full_name,c.email,c.phone,c.age,c.preferences,c.created_at,c.locked,c.lock_reason,
        coalesce(p.completed_orders,0) completed_orders,coalesce(p.completed_value,0) completed_value,p.last_completed_order_at
      from customers c left join purchases p on p.customer_id=c.customer_id
      where c.role='CUSTOMER' and c.deleted_at is null
    ), classified as (select metrics.*, %s stage from metrics)
    """
        .formatted(CustomerLifecycle.stageSql());
  }

  private void conditions(Filters f, LocalDate today, StringBuilder where, List<Object> args) {
    String average =
        "(select avg(cast(f.rating as decimal(10,4))) from feedback f where"
            + " f.customer_id=classified.customer_id and f.deleted_at is null and f.rating between"
            + " 1 and 5)";
    if (f.minRating() != null) add(where, args, average + " >= ?", f.minRating());
    if (f.maxRating() != null) add(where, args, average + " <= ?", f.maxRating());
    if (f.surveyId() != null)
      add(
          where,
          args,
          "exists (select 1 from survey_definitions s where s.id=? and"
              + " (coalesce(s.audience,'ALL')='ALL' or exists (select 1 from survey_recipients sr"
              + " where sr.survey_id=s.id and sr.customer_id=classified.customer_id)))",
          f.surveyId());
    if (f.surveyed() != null) {
      where
          .append(f.surveyed() ? " and exists" : " and not exists")
          .append(" (select 1 from survey_responses r where r.customer_id=classified.customer_id");
      if (f.surveyId() != null) {
        where.append(" and r.survey_id=?");
        args.add(f.surveyId());
      }
      where.append(")");
    }
    if (f.stage() != null) add(where, args, "stage = ?", f.stage());
    if (f.dormant() != null) {
      Instant cutoff =
          today
              .minusDays(CustomerLifecycle.DORMANT_DAYS)
              .plusDays(1)
              .atStartOfDay(CustomerLifecycle.ZONE)
              .toInstant();
      add(
          where,
          args,
          f.dormant()
              ? "(completed_orders>0 and last_completed_order_at < ?)"
              : "(completed_orders=0 or last_completed_order_at is null or last_completed_order_at"
                  + " >= ?)",
          java.sql.Timestamp.from(cutoff));
    }
    if (f.minCompletedOrders() != null)
      add(where, args, "completed_orders >= ?", f.minCompletedOrders());
    if (f.maxCompletedOrders() != null)
      add(where, args, "completed_orders <= ?", f.maxCompletedOrders());
    if (f.minCompletedValue() != null)
      add(where, args, "completed_value >= ?", f.minCompletedValue());
    if (f.maxCompletedValue() != null)
      add(where, args, "completed_value <= ?", f.maxCompletedValue());
    if (f.lastPurchaseFrom() != null)
      add(
          where,
          args,
          "last_completed_order_at >= ?",
          java.sql.Timestamp.from(
              f.lastPurchaseFrom().atStartOfDay(CustomerLifecycle.ZONE).toInstant()));
    if (f.lastPurchaseTo() != null)
      add(
          where,
          args,
          "last_completed_order_at < ?",
          java.sql.Timestamp.from(
              f.lastPurchaseTo().plusDays(1).atStartOfDay(CustomerLifecycle.ZONE).toInstant()));
  }

  CustomerProfileService.Page<Customer> list(Filters f, LocalDate today) {
    var match = matching(f, today);
    String cte = match.cte();
    var where = match.where();
    var args = match.args();
    long count =
        db.queryForObject(
            cte + "select count(*) from classified" + where, Long.class, args.toArray());
    args.add(f.size());
    args.add((long) f.page() * f.size());
    var rows =
        db.query(
            cte
                + "select * from classified"
                + where
                + " order by "
                + SORTS.get(f.sort())
                + " "
                + f.direction()
                + " nulls last,customer_id desc limit ? offset ?",
            (r, n) -> {
              Instant last =
                  r.getTimestamp("last_completed_order_at") == null
                      ? null
                      : r.getTimestamp("last_completed_order_at").toInstant();
              long completed = r.getLong("completed_orders");
              BigDecimal value = r.getBigDecimal("completed_value");
              return new Customer(
                  r.getLong("customer_id"),
                  r.getString("full_name"),
                  r.getString("email"),
                  r.getString("phone"),
                  (Integer) r.getObject("age"),
                  r.getString("preferences"),
                  r.getTimestamp("created_at").toInstant(),
                  r.getBoolean("locked"),
                  r.getString("lock_reason"),
                  completed,
                  value,
                  last,
                  CustomerLifecycle.calculate(completed, value, last, today));
            },
            args.toArray());
    return new CustomerProfileService.Page<>(
        rows, count, (count + f.size() - 1) / f.size(), f.page(), f.size());
  }

  public record RecipientFilter(
      String q,
      String stage,
      Boolean dormant,
      Long minCompletedOrders,
      Long maxCompletedOrders,
      BigDecimal minCompletedValue,
      BigDecimal maxCompletedValue,
      LocalDate lastPurchaseFrom,
      LocalDate lastPurchaseTo,
      BigDecimal minRating,
      BigDecimal maxRating,
      Boolean surveyed,
      Long surveyId) {
    public RecipientFilter(
        String q,
        String stage,
        Boolean dormant,
        Long minCompletedOrders,
        Long maxCompletedOrders,
        BigDecimal minCompletedValue,
        BigDecimal maxCompletedValue,
        LocalDate lastPurchaseFrom,
        LocalDate lastPurchaseTo,
        BigDecimal minRating,
        BigDecimal maxRating,
        Boolean surveyed) {
      this(
          q,
          stage,
          dormant,
          minCompletedOrders,
          maxCompletedOrders,
          minCompletedValue,
          maxCompletedValue,
          lastPurchaseFrom,
          lastPurchaseTo,
          minRating,
          maxRating,
          surveyed,
          null);
    }

    Filters filters(int page, int size) {
      return new Filters(
          q,
          stage,
          dormant,
          minCompletedOrders,
          maxCompletedOrders,
          minCompletedValue,
          maxCompletedValue,
          lastPurchaseFrom,
          lastPurchaseTo,
          "createdAt",
          "desc",
          page,
          size,
          minRating,
          maxRating,
          surveyed,
          surveyId);
    }
  }

  public record Recipient(long id, String fullName, String email) {}

  public record RecipientPreview(
      long totalMatched,
      long eligibleCount,
      long lockedCount,
      CustomerProfileService.Page<Recipient> recipients) {}

  public RecipientPreview preview(RecipientFilter filter, int page, int size) {
    if (filter == null) throw invalid("Thiếu bộ lọc người nhận.");
    var match = matching(filter.filters(page, size), LocalDate.now(CustomerLifecycle.ZONE));
    long[] counts =
        db.queryForObject(
            match.cte()
                + "select count(*),coalesce(sum(case when locked=false then 1 else 0 end),0) from"
                + " classified"
                + match.where(),
            (r, n) -> new long[] {r.getLong(1), r.getLong(2)},
            match.args().toArray());
    var args = new ArrayList<>(match.args());
    args.add(size);
    args.add((long) page * size);
    var recipients =
        db.query(
            match.cte()
                + "select customer_id,full_name,email from classified"
                + match.where()
                + " and locked=false order by customer_id limit ? offset ?",
            (r, n) -> new Recipient(r.getLong(1), r.getString(2), r.getString(3)),
            args.toArray());
    return new RecipientPreview(
        counts[0],
        counts[1],
        counts[0] - counts[1],
        new CustomerProfileService.Page<>(
            recipients, counts[1], (counts[1] + size - 1) / size, page, size));
  }

  public List<Long> recipientIds(RecipientFilter filter) {
    if (filter == null) throw invalid("Thiếu bộ lọc người nhận.");
    var match = matching(filter.filters(0, 1), LocalDate.now(CustomerLifecycle.ZONE));
    return db.queryForList(
        match.cte()
            + "select customer_id from classified"
            + match.where()
            + " and locked=false order by customer_id",
        Long.class,
        match.args().toArray());
  }

  public record SurveyOption(long id, String title, String status, boolean deleted) {}

  public record SurveyOptions(
      CustomerProfileService.Page<SurveyOption> options, SurveyOption selected) {}

  private SurveyOption surveyOption(long id) {
    if (id < 1) throw invalid("Mã khảo sát không hợp lệ.");
    var rows =
        db.query(
            "select id,title,status,deleted_at from survey_definitions where id=?",
            (r, n) ->
                new SurveyOption(
                    r.getLong(1), r.getString(2), r.getString(3), r.getTimestamp(4) != null),
            id);
    if (rows.isEmpty()) throw invalid("Không tìm thấy khảo sát đã chọn. Hãy chọn lại khảo sát.");
    return rows.getFirst();
  }

  public SurveyOptions surveyOptions(String q, int page, int size, Long selectedId) {
    if (q == null || q.length() > 255 || page < 0 || size < 1 || size > 100)
      throw invalid("Bộ lọc danh sách khảo sát không hợp lệ.");
    var selected = selectedId == null ? null : surveyOption(selectedId);
    String pattern =
        "%"
            + q.trim()
                .toLowerCase(Locale.ROOT)
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_")
            + "%";
    long total =
        db.queryForObject(
            "select count(*) from survey_definitions where lower(title) like ? escape '!'",
            Long.class,
            pattern);
    var rows =
        db.query(
            "select id,title,status,deleted_at from survey_definitions where lower(title) like ?"
                + " escape '!' order by created_at desc,id desc limit ? offset ?",
            (r, n) ->
                new SurveyOption(
                    r.getLong(1), r.getString(2), r.getString(3), r.getTimestamp(4) != null),
            pattern,
            size,
            (long) page * size);
    return new SurveyOptions(
        new CustomerProfileService.Page<>(rows, total, (total + size - 1) / size, page, size),
        selected);
  }

  private static void add(StringBuilder where, List<Object> args, String condition, Object value) {
    where.append(" and ").append(condition);
    args.add(value);
  }
}
