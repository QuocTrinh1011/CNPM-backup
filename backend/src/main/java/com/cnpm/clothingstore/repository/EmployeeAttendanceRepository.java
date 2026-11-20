package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.EmployeeAttendance;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EmployeeAttendanceRepository extends JpaRepository<EmployeeAttendance, Long> {
    @EntityGraph(attributePaths = {"employee", "employee.account", "recordedBy"})
    Optional<EmployeeAttendance> findByEmployee_EmployeeIdAndAttendanceDate(Long employeeId, LocalDate attendanceDate);

    @EntityGraph(attributePaths = {"employee", "employee.account", "recordedBy"})
    @Query("""
            select attendance from EmployeeAttendance attendance
            where attendance.attendanceDate between :startDate and :endDate
              and (:employeeId is null or attendance.employee.employeeId = :employeeId)
            order by attendance.attendanceDate, attendance.employee.employeeId
            """)
    List<EmployeeAttendance> findMonth(@Param("startDate") LocalDate startDate,
                                       @Param("endDate") LocalDate endDate,
                                       @Param("employeeId") Long employeeId);

    @EntityGraph(attributePaths = {"employee", "employee.account", "recordedBy"})
    @Query("""
            select attendance from EmployeeAttendance attendance
            where attendance.attendanceDate between :startDate and :endDate
              and attendance.employee.employeeId in :employeeIds
            order by attendance.attendanceDate, attendance.employee.employeeId
            """)
    List<EmployeeAttendance> findMonthForEmployees(@Param("startDate") LocalDate startDate,
                                                   @Param("endDate") LocalDate endDate,
                                                   @Param("employeeIds") List<Long> employeeIds);

    @EntityGraph(attributePaths = {"employee", "employee.account"})
    @Query("select attendance from EmployeeAttendance attendance where attendance.attendanceDate between :startDate and :endDate order by attendance.attendanceDate, attendance.employee.employeeId")
    List<EmployeeAttendance> findPayrollRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
