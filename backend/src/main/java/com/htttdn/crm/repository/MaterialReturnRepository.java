package com.htttdn.crm.repository;

import com.htttdn.crm.entity.MaterialReturn;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MaterialReturnRepository extends JpaRepository<MaterialReturn, Long> {
    boolean existsByPlan_IdAndStatus(Long planId, String status);

    @EntityGraph(attributePaths = {"plan", "employee", "employee.account"})
    Page<MaterialReturn> findAllByEmployee_EmployeeIdOrderByRequestedAtDescIdDesc(Long employeeId, Pageable pageable);

    @EntityGraph(attributePaths = {"plan", "employee", "employee.account"})
    Page<MaterialReturn> findAllByOrderByRequestedAtDescIdDesc(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select materialReturn from MaterialReturn materialReturn where materialReturn.id = :id")
    Optional<MaterialReturn> findByIdForUpdate(@Param("id") Long id);
}
