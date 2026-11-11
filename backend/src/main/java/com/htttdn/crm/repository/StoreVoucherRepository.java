package com.htttdn.crm.repository;

import com.htttdn.crm.entity.StoreVoucher;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface StoreVoucherRepository
    extends JpaRepository<StoreVoucher, Long>, JpaSpecificationExecutor<StoreVoucher> {
  @Query(
      """
      select v from StoreVoucher v where v.ownerCustomerId = :customerId or
      (v.ownerCustomerId is null and v.active = true
       and (v.startsAt is null or v.startsAt <= :now)
       and (v.expiresAt is null or v.expiresAt > :now)
       and (v.usageLimit is null or v.usedCount < v.usageLimit))
      """)
  org.springframework.data.domain.Page<StoreVoucher> findWallet(
      @org.springframework.data.repository.query.Param("customerId") Long customerId,
      @org.springframework.data.repository.query.Param("now") java.time.Instant now,
      org.springframework.data.domain.Pageable page);

  org.springframework.data.domain.Page<StoreVoucher> findByOwnerCustomerId(
      Long id, org.springframework.data.domain.Pageable page);

  Optional<StoreVoucher> findByCodeIgnoreCase(String code);

  @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @Query("select v from StoreVoucher v where upper(v.code)=upper(:code)")
  Optional<StoreVoucher> lockByCode(
      @org.springframework.data.repository.query.Param("code") String code);

  @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @Query("select v from StoreVoucher v where v.id=:id")
  Optional<StoreVoucher> lockById(@org.springframework.data.repository.query.Param("id") Long id);
}
