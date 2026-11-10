package com.htttdn.crm.entity;

import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="customer_notifications")
public class CustomerNotification {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="customer_id") private User customer; @Column(nullable=false,length=150) private String title; @Column(nullable=false,length=2000) private String content; @Column(length=30) private String type; @Column(name="order_id") private Long orderId; @Column(name="read_at") private Instant readAt; @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
    public CustomerNotification(){}
    public Long getId(){return id;} public User getCustomer(){return customer;} public void setCustomer(User v){customer=v;} public String getTitle(){return title;} public void setTitle(String v){title=v;} public String getContent(){return content;} public void setContent(String v){content=v;} public String getType(){return type;} public void setType(String v){type=v;} public Long getOrderId(){return orderId;} public void setOrderId(Long v){orderId=v;} public Instant getReadAt(){return readAt;} public void setReadAt(Instant v){readAt=v;} public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
}
