package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.RawMaterial;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface RawMaterialRepository extends JpaRepository<RawMaterial, Long> {
    Optional<RawMaterial> findByCodeIgnoreCase(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select material from RawMaterial material where material.id = :id")
    Optional<RawMaterial> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select material from RawMaterial material where material.id in :ids order by material.id")
    List<RawMaterial> findAllByIdInForUpdate(@Param("ids") List<Long> ids);
}
