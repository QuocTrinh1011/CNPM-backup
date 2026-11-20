package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.MaterialReturnItem;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaterialReturnItemRepository extends JpaRepository<MaterialReturnItem, Long> {
    @EntityGraph(attributePaths = {"planMaterial", "planMaterial.material"})
    List<MaterialReturnItem> findByMaterialReturn_IdOrderByIdAsc(Long returnId);

    @EntityGraph(attributePaths = {"materialReturn", "planMaterial", "planMaterial.material"})
    List<MaterialReturnItem> findByMaterialReturn_IdInOrderByMaterialReturn_IdAscIdAsc(List<Long> returnIds);
}
