package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.EmployeePayrollLine;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EmployeePayrollLineRepository extends JpaRepository<EmployeePayrollLine, Long> {
    List<EmployeePayrollLine> findByPayslip_IdOrderByDisplayOrderAscIdAsc(Long payslipId);
}
