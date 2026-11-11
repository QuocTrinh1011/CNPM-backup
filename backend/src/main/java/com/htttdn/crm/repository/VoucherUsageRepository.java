package com.htttdn.crm.repository;

import com.htttdn.crm.entity.VoucherUsage;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VoucherUsageRepository extends JpaRepository<VoucherUsage, Long> {
  @org.springframework.data.jpa.repository.Query(
      "select count(u) from VoucherUsage u where u.voucher.id=:voucherId and"
          + " u.order.customer.id=:customerId and u.releasedAt is null")
  long countActive(
      @org.springframework.data.repository.query.Param("voucherId") Long voucherId,
      @org.springframework.data.repository.query.Param("customerId") Long customerId);

  interface CustomerCount {
    Long getVoucherId();

    Long getUses();
  }

  @org.springframework.data.jpa.repository.Query(
      "select u.voucher.id as voucherId,count(u) as uses from VoucherUsage u where u.voucher.id in"
          + " :ids and u.order.customer.id=:customerId and u.releasedAt is null group by"
          + " u.voucher.id")
  java.util.List<CustomerCount> customerCounts(
      @org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids,
      @org.springframework.data.repository.query.Param("customerId") Long customerId);

  Optional<VoucherUsage> findByOrderId(Long orderId);
}
