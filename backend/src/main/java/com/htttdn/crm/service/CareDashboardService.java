package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CareDashboardService {
  private final JdbcTemplate db;

  public CareDashboardService(JdbcTemplate db) {
    this.db = db;
  }

  public record Counts(long total, long todo, long inProgress, long completed, long overdue) {}

  public record Staff(long id, String name, boolean active, Counts counts) {}

  public record Dashboard(
      Counts counts, List<Staff> staff, long dormantWithoutOpenTask, Instant asOf) {}

  public record Customer(long id, String fullName, Instant lastPurchaseAt) {}

  private ApiException bad() {
    return new ApiException(
        HttpStatus.BAD_REQUEST,
        "INVALID_CARE_FILTER",
        "Khoảng ngày hoặc người phụ trách không hợp lệ.");
  }

  private String scope(LocalDate from, LocalDate to, Long assignee, List<Object> args) {
    if (from != null && to != null && from.isAfter(to) || assignee != null && assignee < 1)
      throw bad();
    String sql =
        " from customer_care_tasks t join customers c on c.customer_id=t.customer_id join customers"
            + " a on a.customer_id=t.assignee_id where c.role='CUSTOMER' and c.deleted_at is null";
    if (from != null) {
      sql += " and t.due_at>=?";
      args.add(Timestamp.from(from.atStartOfDay(CustomerLifecycle.ZONE).toInstant()));
    }
    if (to != null) {
      sql += " and t.due_at<?";
      args.add(Timestamp.from(to.plusDays(1).atStartOfDay(CustomerLifecycle.ZONE).toInstant()));
    }
    if (assignee != null) {
      sql += " and t.assignee_id=?";
      args.add(assignee);
    }
    return sql;
  }

  private String columns() {
    return "count(*) total, coalesce(sum(case when t.status='TODO' then 1 else 0 end),0) todo,"
        + " coalesce(sum(case when t.status='IN_PROGRESS' then 1 else 0 end),0) progressing,"
        + " coalesce(sum(case when t.status='COMPLETED' then 1 else 0 end),0) completed,"
        + " coalesce(sum(case when t.status<>'COMPLETED' and t.due_at<? then 1 else 0"
        + " end),0) overdue";
  }

  private Counts counts(java.sql.ResultSet r) throws java.sql.SQLException {
    return new Counts(
        r.getLong("total"),
        r.getLong("todo"),
        r.getLong("progressing"),
        r.getLong("completed"),
        r.getLong("overdue"));
  }

  public Dashboard dashboard(LocalDate from, LocalDate to, Long assignee) {
    Instant now = Instant.now();
    List<Object> args = new ArrayList<>();
    args.add(Timestamp.from(now));
    String scope = scope(from, to, assignee, args);
    Counts total =
        db.queryForObject("select " + columns() + scope, (r, n) -> counts(r), args.toArray());
    var staff =
        db.query(
            "select a.customer_id,a.full_name,a.role,a.locked,a.deleted_at,"
                + columns()
                + scope
                + " group by a.customer_id,a.full_name,a.role,a.locked,a.deleted_at order by"
                + " a.full_name,a.customer_id",
            (r, n) ->
                new Staff(
                    r.getLong("customer_id"),
                    r.getString("full_name"),
                    "MANAGER".equals(r.getString("role"))
                        && !r.getBoolean("locked")
                        && r.getTimestamp("deleted_at") == null,
                    counts(r)),
            args.toArray());
    long dormant = db.queryForObject("select count(*)" + dormantScope(), Long.class, cutoff());
    return new Dashboard(total, staff, dormant, now);
  }

  private Timestamp cutoff() {
    return Timestamp.from(
        LocalDate.now(CustomerLifecycle.ZONE)
            .minusDays(CustomerLifecycle.DORMANT_DAYS)
            .plusDays(1)
            .atStartOfDay(CustomerLifecycle.ZONE)
            .toInstant());
  }

  private String dormantScope() {
    return " from customers c join (select customer_id,max(created_at) last_purchase from orders"
        + " where status='COMPLETED' group by customer_id) p on p.customer_id=c.customer_id"
        + " where c.role='CUSTOMER' and c.deleted_at is null and p.last_purchase<? and not"
        + " exists (select 1 from customer_care_tasks t where t.customer_id=c.customer_id"
        + " and t.status<>'COMPLETED')";
  }

  public CustomerProfileService.Page<Customer> dormant(int page, int size) {
    if (page < 0 || size < 1 || size > 100) throw bad();
    Timestamp cutoff = cutoff();
    String scope = dormantScope();
    long count = db.queryForObject("select count(*)" + scope, Long.class, cutoff);
    var rows =
        db.query(
            "select c.customer_id,c.full_name,p.last_purchase"
                + scope
                + " order by p.last_purchase,c.customer_id limit ? offset ?",
            (r, n) -> new Customer(r.getLong(1), r.getString(2), r.getTimestamp(3).toInstant()),
            cutoff,
            size,
            (long) page * size);
    return new CustomerProfileService.Page<>(rows, count, (count + size - 1) / size, page, size);
  }
}
