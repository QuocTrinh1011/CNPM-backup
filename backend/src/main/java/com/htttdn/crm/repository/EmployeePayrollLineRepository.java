package com.htttdn.crm.repository;

import com.htttdn.crm.entity.EmployeePayrollLine;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EmployeePayrollLineRepository extends JpaRepository<EmployeePayrollLine, Long> {
    List<EmployeePayrollLine> findByPayslip_IdOrderByDisplayOrderAscIdAsc(Long payslipId);
}
