package com.htttdn.crm.service;

import com.fasterxml.jackson.databind.*;
import com.htttdn.crm.entity.AuditLog;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.AuditLogRepository;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AuditLogQuery {
  public static final Set<String> TYPES =
      Set.of(
          "ORDER",
          "CUSTOMER",
          "ACCOUNT",
          "PRODUCT",
          "VOUCHER",
          "FEEDBACK",
          "SURVEY",
          "CARE_TASK",
          "CARE_NOTE",
          "SUPPORT_TICKET");
  public static final Set<String> ACTIONS =
      Set.of(
          "CREATE",
          "UPDATE",
          "DELETE",
          "LOCK",
          "UNLOCK",
          "ORDER_STATUS",
          "RETURN_PROCESS",
          "STOCK",
          "ARCHIVE",
          "REWARD",
          "PUBLISH",
          "UNPUBLISH",
          "CUSTOMER_CANCEL",
          "CUSTOMER_RECEIPT",
          "REFUND_REQUEST",
          "REFUND_COMPLETE",
          "REFUND_REJECT",
          "COD_COLLECTED");
  private final AuditLogRepository logs;
  private final ObjectMapper mapper;

  public AuditLogQuery(AuditLogRepository logs, ObjectMapper mapper) {
    this.logs = logs;
    this.mapper = mapper;
  }

  public record View(
      Long id,
      Long actorId,
      String actorName,
      String actorRole,
      String action,
      String entityType,
      Long targetId,
      JsonNode beforeData,
      JsonNode afterData,
      Instant createdAt) {}

  public record Result(
      List<View> content, long totalElements, int totalPages, int number, int size) {}

  public Result list(
      String q, String type, String action, Instant from, Instant to, int page, int size) {
    if (page < 0
        || size < 1
        || size > 100
        || q.length() > 150
        || type != null && !TYPES.contains(type)
        || action != null && !ACTIONS.contains(action)
        || from != null && to != null && !from.isBefore(to))
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_AUDIT_FILTER", "Bộ lọc nhật ký không hợp lệ.");
    var actor = AuditTrail.actor();
    if (actor == null || !"ADMIN".equals(actor.role()))
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Không có quyền xem nhật ký.");
    var result =
        logs.findAll(
            (r, x, c) -> {
              var p = new ArrayList<jakarta.persistence.criteria.Predicate>();
              if (type != null) p.add(c.equal(r.get("entityType"), type));
              if (action != null) p.add(c.equal(r.get("action"), action));
              if (from != null) p.add(c.greaterThanOrEqualTo(r.get("createdAt"), from));
              if (to != null) p.add(c.lessThan(r.get("createdAt"), to));
              if (!q.isBlank()) {
                String pattern =
                    "%"
                        + q.trim()
                            .toLowerCase(Locale.ROOT)
                            .replace("!", "!!")
                            .replace("%", "!%")
                            .replace("_", "!_")
                        + "%";
                var term = c.like(c.lower(r.get("actorName")), pattern, '!');
                try {
                  long id = Long.parseLong(q.trim());
                  p.add(c.or(term, c.equal(r.get("targetId"), id), c.equal(r.get("actorId"), id)));
                } catch (NumberFormatException ignored) {
                  p.add(term);
                }
              }
              return c.and(p.toArray(jakarta.persistence.criteria.Predicate[]::new));
            },
            PageRequest.of(
                page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
    return new Result(
        result.getContent().stream().map(this::view).toList(),
        result.getTotalElements(),
        result.getTotalPages(),
        page,
        size);
  }

  private View view(AuditLog log) {
    try {
      return new View(
          log.getId(),
          log.getActorId(),
          log.getActorName(),
          log.getActorRole(),
          log.getAction(),
          log.getEntityType(),
          log.getTargetId(),
          mapper.readTree(log.getBeforeData()),
          mapper.readTree(log.getAfterData()),
          log.getCreatedAt());
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException("Invalid audit data", e);
    }
  }
}
