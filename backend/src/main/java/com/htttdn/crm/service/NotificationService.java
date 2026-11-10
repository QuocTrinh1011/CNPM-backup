package com.htttdn.crm.service;

import com.htttdn.crm.entity.*; import com.htttdn.crm.repository.CustomerNotificationRepository; import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional; import java.time.Instant;
@Service public class NotificationService {
    @org.springframework.beans.factory.annotation.Autowired private org.springframework.context.ApplicationEventPublisher events;
    @org.springframework.beans.factory.annotation.Autowired private TransactionalMail mail;
    private final CustomerNotificationRepository notifications; public NotificationService(CustomerNotificationRepository notifications){this.notifications=notifications;}
    @Transactional public void create(User customer,String title,String content,String type,Long orderId){CustomerNotification n=new CustomerNotification();n.setCustomer(customer);n.setTitle(title);n.setContent(content);n.setType(type);n.setOrderId(orderId);n.setCreatedAt(Instant.now());notifications.save(n);
        if(orderId!=null && (type.startsWith("ORDER_") || type.startsWith("RETURN_")) && mail.permits(customer.getEmail()))
            events.publishEvent(new TransactionalMail.OrderEmail(customer.getEmail(),"ANH LỚN SHOP — "+title,content+"\n\nXem đơn hàng: "+mail.link("/don-hang/"+orderId),"notification-"+n.getId()));
    }
}
