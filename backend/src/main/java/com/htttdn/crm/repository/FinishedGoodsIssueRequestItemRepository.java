package com.htttdn.crm.repository;

import com.htttdn.crm.entity.FinishedGoodsIssueRequestItem;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinishedGoodsIssueRequestItemRepository extends JpaRepository<FinishedGoodsIssueRequestItem, Long> {
    @EntityGraph(attributePaths = {"product"})
    List<FinishedGoodsIssueRequestItem> findByRequest_IdOrderByIdAsc(Long requestId);

    @EntityGraph(attributePaths = {"request", "product"})
    List<FinishedGoodsIssueRequestItem> findByRequest_IdInOrderByRequest_IdAscIdAsc(List<Long> requestIds);
}
