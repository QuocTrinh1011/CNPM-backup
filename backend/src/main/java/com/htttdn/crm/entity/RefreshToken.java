package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "refresh_tokens", uniqueConstraints = @UniqueConstraint(columnNames = "token_hash"))
public class RefreshToken {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id")
  private User user;

  @Column(name = "token_hash", nullable = false, length = 128)
  private String tokenHash;

  @Column(nullable = false, length = 64)
  private String familyId;

  @Column(nullable = false)
  private Instant expiresAt;

  @Column(nullable = false, length = 20)
  private String status = "ACTIVE";

  @Column(length = 20)
  private String audience;

  private String revokeReason;
  private Instant createdAt = Instant.now();
  private Instant revokedAt;

  public RefreshToken() {}

  public Long getId() {
    return id;
  }

  public User getUser() {
    return user;
  }

  public void setUser(User v) {
    user = v;
  }

  public String getTokenHash() {
    return tokenHash;
  }

  public void setTokenHash(String v) {
    tokenHash = v;
  }

  public String getFamilyId() {
    return familyId;
  }

  public void setFamilyId(String v) {
    familyId = v;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant v) {
    expiresAt = v;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String v) {
    status = v;
  }

  public String getAudience() {
    return audience;
  }

  public void setAudience(String v) {
    audience = v;
  }

  public String getRevokeReason() {
    return revokeReason;
  }

  public void setRevokeReason(String v) {
    revokeReason = v;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant v) {
    createdAt = v;
  }

  public Instant getRevokedAt() {
    return revokedAt;
  }

  public void setRevokedAt(Instant v) {
    revokedAt = v;
  }
}
