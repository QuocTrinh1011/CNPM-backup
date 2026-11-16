package com.htttdn.crm.repository;

import com.htttdn.crm.entity.ProductionPlanMaterial;
import jakarta.persistence.LockModeType;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductionPlanMaterialRepository extends JpaRepository<ProductionPlanMaterial, Long> {
    @EntityGraph(attributePaths = "material")
    List<ProductionPlanMaterial> findByPlan_IdOrderByIdAsc(Long planId);

    @EntityGraph(attributePaths = "material")
    List<ProductionPlanMaterial> findByPlan_IdInOrderByPlan_IdAscIdAsc(List<Long> planIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "material")
    @Query("select item from ProductionPlanMaterial item where item.plan.id = :planId order by item.material.id, item.id")
    List<ProductionPlanMaterial> findAllByPlanIdForUpdate(@Param("planId") Long planId);

    @Query("select coalesce(sum(item.quantity), 0) from MaterialIssueRequestItem item "
            + "where item.planMaterial.id = :planMaterialId and item.request.status = 'PENDING'")
    java.math.BigDecimal sumPendingIssueQuantity(@Param("planMaterialId") Long planMaterialId);

    @Query("select coalesce(sum(item.quantity), 0) from MaterialReturnItem item "
            + "where item.planMaterial.id = :planMaterialId and item.materialReturn.status = 'PENDING'")
    java.math.BigDecimal sumPendingReturnQuantity(@Param("planMaterialId") Long planMaterialId);
}
