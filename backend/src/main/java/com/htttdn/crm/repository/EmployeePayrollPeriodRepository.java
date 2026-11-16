package com.htttdn.crm.repository;

import com.htttdn.crm.entity.EmployeePayrollPeriod;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface EmployeePayrollPeriodRepository extends JpaRepository<EmployeePayrollPeriod, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select period from EmployeePayrollPeriod period where period.periodYear = :year and period.periodMonth = :month")
    Optional<EmployeePayrollPeriod> findForUpdate(@Param("year") int year, @Param("month") int month);

    @EntityGraph(attributePaths = {"createdBy", "reviewedBy", "publishedBy", "payslips", "payslips.employee", "payslips.employee.account", "payslips.lines"})
    Optional<EmployeePayrollPeriod> findByPeriodYearAndPeriodMonth(int periodYear, int periodMonth);
}
