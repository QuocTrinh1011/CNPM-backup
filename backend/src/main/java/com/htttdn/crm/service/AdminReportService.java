package com.htttdn.crm.service;

import com.htttdn.crm.repository.OrderRepository;
import com.htttdn.crm.repository.SurveyRepository;
import com.htttdn.crm.repository.UserRepository;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class AdminReportService {
  private final OrderRepository orders;
  private final UserRepository users;
  private final SurveyRepository surveys;

  public AdminReportService(
      OrderRepository orders, UserRepository users, SurveyRepository surveys) {
    this.orders = orders;
    this.users = users;
    this.surveys = surveys;
  }

  public Map<String, Object> revenue() {
    return Map.of(
        "totalRevenue",
        Optional.ofNullable(orders.revenue()).orElse(BigDecimal.ZERO),
        "orders",
        orders.count());
  }

  public Map<String, Object> users() {
    return Map.of(
        "customers",
        users.countByRoleAndDeletedAtIsNull("CUSTOMER"),
        "admins",
        users.countByRole("ADMIN"),
        "lockedCustomers",
        users.countByRoleAndLockedTrueAndDeletedAtIsNull("CUSTOMER"));
  }

  public Map<String, Object> surveyStats() {
    return Map.of(
        "total",
        surveys.countByDeletedAtIsNull(),
        "draft",
        surveys.countByStatusAndDeletedAtIsNull("DRAFT"),
        "published",
        surveys.countByStatusAndDeletedAtIsNull("PUBLISHED"));
  }
}
