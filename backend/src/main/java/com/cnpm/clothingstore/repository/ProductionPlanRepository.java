package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.ProductionPlan;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductionPlanRepository extends JpaRepository<ProductionPlan, Long> {
    @EntityGraph(attributePaths = {"product", "recipe", "assignedEmployee", "assignedEmployee.account"})
    Page<ProductionPlan> findAllByAssignedEmployee_EmployeeIdOrderByCreatedAtDescIdDesc(
            Long employeeId, Pageable pageable);

    @EntityGraph(attributePaths = {"product", "recipe", "assignedEmployee", "assignedEmployee.account"})
    Page<ProductionPlan> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"product", "recipe", "assignedEmployee", "assignedEmployee.account"})
    Optional<ProductionPlan> findById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select plan from ProductionPlan plan where plan.id = :id")
    Optional<ProductionPlan> findByIdForUpdate(@Param("id") Long id);
}
