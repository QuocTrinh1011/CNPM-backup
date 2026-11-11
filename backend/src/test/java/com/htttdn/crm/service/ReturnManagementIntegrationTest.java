package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.security.JwtTokenService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:returnTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class ReturnManagementIntegrationTest {
  @Autowired ReturnManagementService service;
  @Autowired AdminOrderService admin;
  @Autowired OrderService customerOrders;
  @Autowired EntityManager em;
  @Autowired MockMvc mvc;
  @Autowired JwtTokenService jwt;
  @Autowired OrderReturnEventRepository events;
  @Autowired CustomerNotificationRepository notifications;
  User manager, customer, root;
  Order order;

  @BeforeEach
  void setup() {
    manager = user("Manager", "MANAGER");
    customer = user("Customer", "CUSTOMER");
    root = user("Admin", "ADMIN");
    order = order(10001L, "REQUESTED");
    em.flush();
  }

  User user(String name, String role) {
    User u = new User();
    u.setFullName(name);
    u.setEmail(name + "@return.test");
    u.setPasswordHash("hash");
    u.setRole(role);
    em.persist(u);
    return u;
  }

  Order order(long code, String status) {
    Order o = new Order();
    o.setOrderCode(code);
    o.setCustomer(customer);
    o.setStatus("DELIVERED");
    o.setPaymentMethod("COD");
    o.setPaymentStatus("COD");
    o.setReturnStatus(status);
    o.setReturnReason("Sai size");
    o.setTotalAmount(BigDecimal.TEN);
    o.setDiscountAmount(BigDecimal.ONE);
    o.setVoucherCode("KEEP");
    em.persist(o);
    return o;
  }

  String token(User u) {
    return "Bearer " + jwt.issue(u.getId(), u.getRole());
  }

  Order process(String status, String note) {
    return service.process(
        token(manager), order.getId(), new ReturnManagementService.Request(status, note));
  }

  @Test
  void approveCompletePreservesFinancialDataAndNotifiesOnce() {
    process("APPROVED", "  Tiếp nhận hàng  ");
    process("APPROVED", "Tiếp nhận hàng");
    process("COMPLETED", "Đã đổi size tại cửa hàng");
    process("COMPLETED", "Đã đổi size tại cửa hàng");
    em.flush();
    assertEquals(2, events.count());
    assertEquals(2, notifications.count());
    assertEquals("COMPLETED", order.getReturnStatus());
    assertEquals("DELIVERED", order.getStatus());
    assertEquals("COD", order.getPaymentStatus());
    assertEquals(BigDecimal.TEN, order.getTotalAmount());
    assertEquals(BigDecimal.ONE, order.getDiscountAmount());
    assertEquals("KEEP", order.getVoucherCode());
    assertFalse(order.isStockReleased());
    assertThrows(ApiException.class, () -> process("REJECTED", "Không hợp lệ"));
    assertThrows(ApiException.class, () -> process("COMPLETED", "Ghi đè"));
    assertEquals("Tiếp nhận hàng", order.getReturnHistory().getFirst().getNote());
    Long id = order.getId();
    em.flush();
    em.clear();
    Order persisted = admin.get(id);
    assertEquals(2, persisted.getReturnHistory().size());
    assertEquals("COMPLETED", persisted.getReturnStatus());
  }

  @Test
  void rejectsWithReasonAndCannotReopen() {
    process("REJECTED", "Không đủ điều kiện");
    process("REJECTED", "Không đủ điều kiện");
    assertEquals(1, events.count());
    assertEquals(1, notifications.count());
    assertThrows(ApiException.class, () -> process("APPROVED", ""));
  }

  @Test
  void validationAndInvalidTransitionsDoNotChangeOrder() {
    for (var r :
        java.util.List.of(
            new ReturnManagementService.Request("REJECTED", " "),
            new ReturnManagementService.Request("COMPLETED", ""),
            new ReturnManagementService.Request("APPROVED", "x".repeat(1001)),
            new ReturnManagementService.Request("OTHER", "note"),
            new ReturnManagementService.Request("COMPLETED", "Cannot skip approval")))
      assertThrows(ApiException.class, () -> service.process(token(manager), order.getId(), r));
    assertEquals("REQUESTED", order.getReturnStatus());
    assertEquals(0, events.count());
    assertEquals(0, notifications.count());
    order.setStatus("CANCELLED");
    assertThrows(ApiException.class, () -> process("APPROVED", ""));
    order.setStatus("DELIVERED");
    order.setReturnStatus("NONE");
    assertThrows(ApiException.class, () -> process("APPROVED", ""));
  }

  @Test
  void filtersReturnBeforePagination() {
    order(10002L, "APPROVED");
    order(10003L, "NONE");
    Order cancelled = order(10004L, "REQUESTED");
    cancelled.setStatus("CANCELLED");
    em.flush();
    assertEquals(2, admin.list("RETURN", 0, 1).getTotalElements());
    assertEquals(1, admin.list("RETURN_REQUESTED", 0, 10).getTotalElements());
    assertEquals(1, admin.list("RETURN_APPROVED", 0, 10).getTotalElements());
    assertThrows(ApiException.class, () -> admin.list("RETURN_BAD", 0, 10));
  }

  @Test
  void managerOnlyAndNoLeakedStaffIds() throws Exception {
    String path = "/api/manager/orders/" + order.getId() + "/return";
    for (User u : java.util.List.of(customer, root))
      mvc.perform(
              patch(path)
                  .header("Authorization", token(u))
                  .contentType("application/json")
                  .content("{\"status\":\"APPROVED\"}"))
          .andExpect(status().isForbidden());
    mvc.perform(patch(path).contentType("application/json").content("{\"status\":\"APPROVED\"}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            patch(path)
                .header("Authorization", token(manager))
                .contentType("application/json")
                .content("{\"status\":\"APPROVED\",\"note\":\"Được duyệt\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.returnHistory[0].managerName").value("Manager"))
        .andExpect(jsonPath("$.returnHistory[0].managerId").doesNotExist())
        .andExpect(jsonPath("$.returnHistory[0].order").doesNotExist());
    var view = customerOrders.view(order);
    assertEquals("Được duyệt", view.returnHistory().getFirst().note());
    mvc.perform(get("/api/orders/" + order.getId()).header("Authorization", token(customer)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.returnHistory[0].note").value("Được duyệt"))
        .andExpect(jsonPath("$.returnHistory[0].managerName").doesNotExist())
        .andExpect(jsonPath("$.returnHistory[0].managerId").doesNotExist());
  }

  @Test
  void deliveryUpdateCannotBypassReturnHandling() {
    assertThrows(
        ApiException.class,
        () ->
            admin.updateStatus(
                order.getId(),
                new com.htttdn.crm.dto.admin.AdminDtos.StatusRequest("DELIVERED", null)));
    assertEquals("REQUESTED", order.getReturnStatus());
  }

  @Test
  void completedPurchaseAndMissingOrder() {
    order.setStatus("COMPLETED");
    process("APPROVED", "");
    assertEquals("COMPLETED", order.getStatus());
    assertThrows(
        ApiException.class,
        () ->
            service.process(
                token(manager), 999999L, new ReturnManagementService.Request("APPROVED", "")));
  }
}
