package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.EmployeeProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.time.LocalDate;

public interface EmployeeProfileRepository extends JpaRepository<EmployeeProfile, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select profile from EmployeeProfile profile where profile.employeeId = :employeeId")
    Optional<EmployeeProfile> findByIdForUpdate(@Param("employeeId") Long employeeId);

    @EntityGraph(attributePaths = "account")
    @Query("select profile from EmployeeProfile profile where profile.account.role = 'EMPLOYEE' and profile.hireDate <= :periodEnd and (profile.resignationDate is null or profile.resignationDate >= :periodStart) order by profile.employeeId")
    List<EmployeeProfile> findForWorkforceReport(@Param("periodStart") LocalDate periodStart, @Param("periodEnd") LocalDate periodEnd);

    @EntityGraph(attributePaths = "account")
    @Query("select profile from EmployeeProfile profile where profile.account.role = 'EMPLOYEE' and profile.account.deletedAt is null and profile.employmentStatus in ('ACTIVE','RESIGNED') and profile.hireDate <= :periodEnd and (profile.resignationDate is null or profile.resignationDate >= :periodStart) order by profile.employeeId")
    List<EmployeeProfile> findEligibleForPayroll(@Param("periodStart") LocalDate periodStart, @Param("periodEnd") LocalDate periodEnd);
    Optional<EmployeeProfile> findByEmployeeCodeIgnoreCase(String employeeCode);
    boolean existsByEmployeeCodeIgnoreCase(String employeeCode);
    boolean existsByReportsToEmployeeId(Long employeeId);

    @EntityGraph(attributePaths = "account")
    @Query("""
            select profile from EmployeeProfile profile
            where profile.reportsToEmployeeId = :teamLeadId
              and profile.permissionProfile = 'STAFF'
              and profile.employmentStatus = 'ACTIVE'
              and profile.account.role = 'EMPLOYEE'
              and profile.account.locked = false
              and profile.account.deletedAt is null
            order by lower(profile.account.fullName), profile.employeeId
            """)
    List<EmployeeProfile> findActiveDirectReports(@Param("teamLeadId") Long teamLeadId);

    @EntityGraph(attributePaths = "account")
    @Query("""
            select profile from EmployeeProfile profile
            where profile.account.role = 'EMPLOYEE'
              and profile.account.locked = false
              and profile.account.deletedAt is null
              and profile.employmentStatus = 'ACTIVE'
              and profile.workArea = 'WAREHOUSE'
            order by lower(profile.account.fullName), profile.employeeId
            """)
    List<EmployeeProfile> findActiveWarehouseEmployees();

    @EntityGraph(attributePaths = "account")
    @Query(value = """
            select profile from EmployeeProfile profile
            where profile.account.role = 'EMPLOYEE'
              and (
                   :status = 'ALL'
                   or (:status = 'ACTIVE'
                       and profile.employmentStatus = 'ACTIVE'
                       and profile.account.locked = false
                       and profile.account.deletedAt is null)
                   or (:status = 'INACTIVE'
                       and (profile.employmentStatus <> 'ACTIVE'
                            or profile.account.locked = true
                            or profile.account.deletedAt is not null))
              )
              and (:permissionProfile is null or profile.permissionProfile = :permissionProfile)
              and (:query = ''
                   or lower(profile.account.fullName) like lower(concat('%', :query, '%'))
                   or lower(profile.account.email) like lower(concat('%', :query, '%'))
                   or profile.account.phone like concat('%', :query, '%')
                   or lower(profile.employeeCode) like lower(concat('%', :query, '%')))
            """,
            countQuery = """
            select count(profile) from EmployeeProfile profile
            where profile.account.role = 'EMPLOYEE'
              and (
                   :status = 'ALL'
                   or (:status = 'ACTIVE'
                       and profile.employmentStatus = 'ACTIVE'
                       and profile.account.locked = false
                       and profile.account.deletedAt is null)
                   or (:status = 'INACTIVE'
                       and (profile.employmentStatus <> 'ACTIVE'
                            or profile.account.locked = true
                            or profile.account.deletedAt is not null))
              )
              and (:permissionProfile is null or profile.permissionProfile = :permissionProfile)
              and (:query = ''
                   or lower(profile.account.fullName) like lower(concat('%', :query, '%'))
                   or lower(profile.account.email) like lower(concat('%', :query, '%'))
                   or profile.account.phone like concat('%', :query, '%')
                   or lower(profile.employeeCode) like lower(concat('%', :query, '%')))
            """)
    Page<EmployeeProfile> searchDirectory(@Param("query") String query,
                                          @Param("status") String status,
                                          @Param("permissionProfile") String permissionProfile,
                                          Pageable pageable);
}
