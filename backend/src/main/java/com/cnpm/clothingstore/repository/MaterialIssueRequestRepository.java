package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.MaterialIssueRequest;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MaterialIssueRequestRepository extends JpaRepository<MaterialIssueRequest, Long> {
    boolean existsByPlan_IdAndStatus(Long planId, String status);

    @EntityGraph(attributePaths = {"plan", "employee", "employee.account"})
    Page<MaterialIssueRequest> findAllByEmployee_EmployeeIdOrderByRequestedAtDescIdDesc(Long employeeId, Pageable pageable);

    @EntityGraph(attributePaths = {"plan", "employee", "employee.account"})
    Page<MaterialIssueRequest> findAllByOrderByRequestedAtDescIdDesc(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from MaterialIssueRequest request where request.id = :id")
    Optional<MaterialIssueRequest> findByIdForUpdate(@Param("id") Long id);
}
