package com.htttdn.crm.repository;

import com.htttdn.crm.entity.ProductionPlanMaterial;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductionPlanMaterialRepository extends JpaRepository<ProductionPlanMaterial, Long> {
    @EntityGraph(attributePaths = "material")
    List<ProductionPlanMaterial> findByPlan_IdOrderByIdAsc(Long planId);

    @EntityGraph(attributePaths = "material")
    List<ProductionPlanMaterial> findByPlan_IdInOrderByPlan_IdAscIdAsc(List<Long> planIds);
}
