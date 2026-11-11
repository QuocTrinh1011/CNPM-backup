package com.htttdn.crm.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

abstract class AdminServiceSupport {
  @org.springframework.beans.factory.annotation.Autowired private AuditTrail auditTrail;

  protected java.util.Map<String, Object> snapshot(Object value) {
    return AuditTrail.snapshot(value);
  }

  protected void audit(
      String action, String type, Long id, java.util.Map<String, Object> before, Object after) {
    // Background jobs and direct service calls have no internal portal actor and are outside this
    // log.
    if (AuditTrail.actor() != null)
      auditTrail.record(
          action, type, id, before, after == null ? java.util.Map.of() : snapshot(after));
  }

  protected Pageable page(int number, int size) {
    return PageRequest.of(
        Math.max(0, number), Math.min(100, Math.max(1, size)), Sort.by("id").descending());
  }
}
