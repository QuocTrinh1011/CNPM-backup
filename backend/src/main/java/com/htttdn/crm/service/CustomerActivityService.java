package com.htttdn.crm.service;

import com.htttdn.crm.exception.ApiException;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Only recorded events; updated_at is never treated as historical status transitions. */
@Service
@Transactional(readOnly = true)
public class CustomerActivityService {
  private final JdbcTemplate db;

  public CustomerActivityService(JdbcTemplate db) {
    this.db = db;
  }

  public record Event(String id, String type, long targetId, String action, Instant createdAt) {}

  private static final String EVENTS =
      """
      with events as (
        select 'ORDER' type,o.order_id target_id,'CREATED' action,o.created_at, o.order_id event_id,o.customer_id
        from orders o
        union all
        select 'FEEDBACK',f.feedback_id,'CREATED',f.created_at,f.feedback_id,f.customer_id
        from feedback f where f.deleted_at is null
        union all
        select 'SURVEY',r.survey_id,'SUBMITTED',r.created_at,r.id,r.customer_id
        from survey_responses r
        union all
        select 'SUPPORT_TICKET',s.id,'CREATED',s.created_at,s.id,s.customer_id
        from support_tickets s
        union all
        select 'CARE_TASK',t.id,'CREATED',t.created_at,t.id,t.customer_id
        from customer_care_tasks t
        union all
        select 'CARE_TASK',t.id,'COMPLETED',t.completed_at,t.id,t.customer_id
        from customer_care_tasks t
        where t.status='COMPLETED' and t.completed_at is not null
        union all
        select a.entity_type,a.target_id,a.action,a.created_at,a.id,o.customer_id
        from audit_logs a join orders o on a.entity_type='ORDER' and o.order_id=a.target_id where a.action<>'CREATE'
        union all
        select a.entity_type,a.target_id,a.action,a.created_at,a.id,s.customer_id
        from audit_logs a join support_tickets s on a.entity_type='SUPPORT_TICKET' and s.id=a.target_id where a.action<>'CREATE'
        union all
        select a.entity_type,a.target_id,a.action,a.created_at,a.id,f.customer_id
        from audit_logs a join feedback f on a.entity_type='FEEDBACK' and f.feedback_id=a.target_id where a.action<>'CREATE' and f.deleted_at is null
      )
      """;

  public CustomerProfileService.Page<Event> list(long customerId, int page, int size) {
    if (page < 0 || size < 1 || size > 100)
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "Phân trang không hợp lệ.");
    if (db.queryForObject(
            "select count(*) from customers where customer_id=? and role='CUSTOMER' and deleted_at"
                + " is null",
            Long.class,
            customerId)
        == 0)
      throw new ApiException(
          HttpStatus.NOT_FOUND, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.");
    long count =
        db.queryForObject(
            EVENTS + "select count(*) from events where customer_id=?", Long.class, customerId);
    var rows =
        db.query(
            EVENTS
                + "select * from events where customer_id=? order by created_at desc,type,target_id"
                + " desc,action,event_id desc limit ? offset ?",
            (r, n) ->
                new Event(
                    r.getString("type") + ":" + r.getLong("event_id") + ":" + r.getString("action"),
                    r.getString("type"),
                    r.getLong("target_id"),
                    r.getString("action"),
                    r.getTimestamp("created_at").toInstant()),
            customerId,
            size,
            (long) page * size);
    return new CustomerProfileService.Page<>(rows, count, (count + size - 1) / size, page, size);
  }
}
