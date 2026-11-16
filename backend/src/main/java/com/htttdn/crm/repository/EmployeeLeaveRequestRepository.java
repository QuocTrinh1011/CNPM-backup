package com.htttdn.crm.repository;

import com.htttdn.crm.entity.EmployeeLeaveRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Optional;

public interface EmployeeLeaveRequestRepository extends JpaRepository<EmployeeLeaveRequest, Long> {
    @EntityGraph(attributePaths = {"employee", "employee.account", "reviewedBy"})
    Page<EmployeeLeaveRequest> findByEmployee_EmployeeId(Long employeeId, Pageable pageable);

    @EntityGraph(attributePaths = {"employee", "employee.account", "reviewedBy"})
    @Query(value = """
            select request from EmployeeLeaveRequest request
            where (:status is null or request.status = :status)
              and (:employeeId is null or request.employee.employeeId = :employeeId)
            """,
            countQuery = """
            select count(request) from EmployeeLeaveRequest request
            where (:status is null or request.status = :status)
              and (:employeeId is null or request.employee.employeeId = :employeeId)
            """)
    Page<EmployeeLeaveRequest> searchForHr(@Param("status") String status,
                                           @Param("employeeId") Long employeeId,
                                           Pageable pageable);

    @EntityGraph(attributePaths = {"employee", "employee.account", "reviewedBy"})
    Optional<EmployeeLeaveRequest> findWithDetailsById(Long id);

    boolean existsByEmployee_EmployeeIdAndStatusInAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            Long employeeId, Collection<String> statuses, LocalDate endDate, LocalDate startDate);
}
