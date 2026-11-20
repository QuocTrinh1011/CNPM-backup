package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.EmployeePayslip;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface EmployeePayslipRepository extends JpaRepository<EmployeePayslip, Long> {
    @EntityGraph(attributePaths = {"employee", "employee.account", "period", "lines", "replacesPayslip"})
    @Query("select slip from EmployeePayslip slip where slip.period.id = :periodId order by slip.employee.employeeId, slip.revision desc")
    List<EmployeePayslip> findAllForPeriod(@Param("periodId") Long periodId);

    @EntityGraph(attributePaths = {"employee", "employee.account", "period", "lines"})
    @Query("select slip from EmployeePayslip slip where slip.employee.employeeId = :employeeId and slip.period.periodYear = :year and slip.period.periodMonth = :month and slip.status = 'PUBLISHED' and slip.revision = (select max(latest.revision) from EmployeePayslip latest where latest.employee.employeeId = :employeeId and latest.period.id = slip.period.id and latest.status = 'PUBLISHED')")
    Optional<EmployeePayslip> findLatestPublished(@Param("employeeId") Long employeeId, @Param("year") int year, @Param("month") int month);

    @EntityGraph(attributePaths = {"employee", "employee.account", "period", "lines"})
    @Query("select slip from EmployeePayslip slip where slip.employee.employeeId = :employeeId and slip.period.periodYear = :year and slip.status = 'PUBLISHED' and slip.revision = (select max(latest.revision) from EmployeePayslip latest where latest.employee.employeeId = :employeeId and latest.period.id = slip.period.id and latest.status = 'PUBLISHED') order by slip.period.periodMonth")
    List<EmployeePayslip> findLatestPublishedForYear(@Param("employeeId") Long employeeId, @Param("year") int year);

    @EntityGraph(attributePaths = {"employee", "employee.account", "period", "lines"})
    @Query("select slip from EmployeePayslip slip where slip.period.id = :periodId and slip.employee.employeeId = :employeeId order by slip.revision desc")
    List<EmployeePayslip> findRevisions(@Param("periodId") Long periodId, @Param("employeeId") Long employeeId);
}
