package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PromotionCampaign;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PromotionCampaignRepository extends JpaRepository<PromotionCampaign, Long> {
    Optional<PromotionCampaign> findByCodeIgnoreCase(String code);

    Page<PromotionCampaign> findByCodeContainingIgnoreCaseOrNameContainingIgnoreCase(
            String code, String name, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PromotionCampaign c where c.id = :id")
    Optional<PromotionCampaign> lockById(@Param("id") Long id);
}
