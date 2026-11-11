package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "customer_addresses")
public class CustomerAddress {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id")
  private User customer;

  @Column(length = 80)
  private String label;

  @Column(name = "recipient_name", nullable = false, length = 150)
  private String recipientName;

  @Column(nullable = false, length = 40)
  private String phone;

  @Column(name = "address_line", nullable = false, length = 500)
  private String addressLine;

  @Column(length = 100)
  private String ward;

  @Column(length = 100)
  private String district;

  @Column(length = 100)
  private String province;

  @Column(name = "default_address", nullable = false)
  private boolean defaultAddress;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  public CustomerAddress() {}

  public Long getId() {
    return id;
  }

  public User getCustomer() {
    return customer;
  }

  public void setCustomer(User v) {
    customer = v;
  }

  public String getLabel() {
    return label;
  }

  public void setLabel(String v) {
    label = v;
  }

  public String getRecipientName() {
    return recipientName;
  }

  public void setRecipientName(String v) {
    recipientName = v;
  }

  public String getPhone() {
    return phone;
  }

  public void setPhone(String v) {
    phone = v;
  }

  public String getAddressLine() {
    return addressLine;
  }

  public void setAddressLine(String v) {
    addressLine = v;
  }

  public String getWard() {
    return ward;
  }

  public void setWard(String v) {
    ward = v;
  }

  public String getDistrict() {
    return district;
  }

  public void setDistrict(String v) {
    district = v;
  }

  public String getProvince() {
    return province;
  }

  public void setProvince(String v) {
    province = v;
  }

  public boolean isDefaultAddress() {
    return defaultAddress;
  }

  public void setDefaultAddress(boolean v) {
    defaultAddress = v;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant v) {
    updatedAt = v;
  }
}
