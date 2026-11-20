package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.MaterialIssueRequestItem;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaterialIssueRequestItemRepository extends JpaRepository<MaterialIssueRequestItem, Long> {
    @EntityGraph(attributePaths = {"planMaterial", "planMaterial.material"})
    List<MaterialIssueRequestItem> findByRequest_IdOrderByIdAsc(Long requestId);

    @EntityGraph(attributePaths = {"request", "planMaterial", "planMaterial.material"})
    List<MaterialIssueRequestItem> findByRequest_IdInOrderByRequest_IdAscIdAsc(List<Long> requestIds);
}
