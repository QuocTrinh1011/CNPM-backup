package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "customers")
public class User {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "customer_id")
  private Long id;

  @Column(unique = true, length = 255)
  private String email;

  @Column(name = "full_name", nullable = false, length = 150)
  private String fullName;

  private Short age;
  private String phone;

  @Column(length = 4000)
  private String preferences;

  private String role = "CUSTOMER";
  private boolean locked = false;

  @Column(name = "lock_reason", length = 2000)
  private String lockReason;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @JsonIgnore
  @Column(name = "password_hash", nullable = false, length = 255)
  private String passwordHash;

  @Column(name = "created_at")
  private Instant createdAt = Instant.now();

  public User() {}

  public Long getId() {
    return id;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String v) {
    email = v;
  }

  public String getFullName() {
    return fullName;
  }

  public void setFullName(String v) {
    fullName = v;
  }

  public Short getAge() {
    return age;
  }

  public void setAge(Short v) {
    age = v;
  }

  public String getPhone() {
    return phone;
  }

  public void setPhone(String v) {
    phone = v;
  }

  public String getRole() {
    return role;
  }

  public void setRole(String v) {
    role = v;
  }

  public boolean isLocked() {
    return locked;
  }

  public void setLocked(boolean v) {
    locked = v;
  }

  public String getPreferences() {
    return preferences;
  }

  public void setPreferences(String v) {
    preferences = v;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public void setPasswordHash(String v) {
    passwordHash = v;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant v) {
    createdAt = v;
  }

  public String getLockReason() {
    return lockReason;
  }

  public void setLockReason(String v) {
    lockReason = v;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(Instant v) {
    deletedAt = v;
  }
}
