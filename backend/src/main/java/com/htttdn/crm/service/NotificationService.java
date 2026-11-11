package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.CustomerNotificationRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {
  @org.springframework.beans.factory.annotation.Autowired
  private org.springframework.context.ApplicationEventPublisher events;

  @org.springframework.beans.factory.annotation.Autowired private TransactionalMail mail;

  @Transactional
  public void createSupport(
      User recipient, String title, String content, String type, Long ticketId) {
    var n = new CustomerNotification();
    n.setCustomer(recipient);
    n.setTitle(title);
    n.setContent(content);
    n.setType(type);
    n.setSupportTicketId(ticketId);
    n.setCreatedAt(Instant.now());
    notifications.save(n);
  }

  private final CustomerNotificationRepository notifications;

  public NotificationService(CustomerNotificationRepository notifications) {
    this.notifications = notifications;
  }

  @Transactional
  public void create(User customer, String title, String content, String type, Long orderId) {
    CustomerNotification n = new CustomerNotification();
    n.setCustomer(customer);
    n.setTitle(title);
    n.setContent(content);
    n.setType(type);
    n.setOrderId(orderId);
    n.setCreatedAt(Instant.now());
    notifications.save(n);
    if (orderId != null
        && (type.startsWith("ORDER_")
            || type.startsWith("RETURN_")
            || type.equals("REFUND_COMPLETED"))
        && mail.permits(customer.getEmail()))
      events.publishEvent(
          new TransactionalMail.OrderEmail(
              customer.getEmail(),
              "ANH LỚN SHOP — " + title,
              content + "\n\nXem đơn hàng: " + mail.link("/don-hang/" + orderId),
              "notification-" + n.getId()));
  }
}
