package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "voucher_usages")
public class VoucherUsage {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @OneToOne(optional = false)
  @JoinColumn(name = "order_id", unique = true, nullable = false)
  private Order order;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "voucher_id", nullable = false)
  private StoreVoucher voucher;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "released_at")
  private Instant releasedAt;

  public VoucherUsage() {}

  public VoucherUsage(Order order, StoreVoucher voucher) {
    this.order = order;
    this.voucher = voucher;
  }

  public StoreVoucher getVoucher() {
    return voucher;
  }

  public Instant getReleasedAt() {
    return releasedAt;
  }

  public void setReleasedAt(Instant value) {
    releasedAt = value;
  }
}
