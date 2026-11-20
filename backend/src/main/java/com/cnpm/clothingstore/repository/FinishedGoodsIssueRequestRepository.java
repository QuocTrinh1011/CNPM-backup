package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.FinishedGoodsIssueRequest;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FinishedGoodsIssueRequestRepository extends JpaRepository<FinishedGoodsIssueRequest, Long> {
    @EntityGraph(attributePaths = {"employee", "employee.account"})
    Page<FinishedGoodsIssueRequest> findAllByEmployee_EmployeeIdOrderByRequestedAtDescIdDesc(
            Long employeeId, Pageable pageable);

    @EntityGraph(attributePaths = {"employee", "employee.account"})
    Page<FinishedGoodsIssueRequest> findAllByOrderByRequestedAtDescIdDesc(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from FinishedGoodsIssueRequest request where request.id = :id")
    Optional<FinishedGoodsIssueRequest> findByIdForUpdate(@Param("id") Long id);
}
