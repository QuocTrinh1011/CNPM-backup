package com.htttdn.crm.repository;

import com.htttdn.crm.entity.EmployeeProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EmployeeProfileRepository extends JpaRepository<EmployeeProfile, Long> {
    Optional<EmployeeProfile> findByEmployeeCodeIgnoreCase(String employeeCode);
    boolean existsByEmployeeCodeIgnoreCase(String employeeCode);
    boolean existsByReportsToEmployeeId(Long employeeId);

    @EntityGraph(attributePaths = "account")
    @Query(value = """
            select profile from EmployeeProfile profile
            where profile.account.role = 'EMPLOYEE'
              and profile.account.deletedAt is null
              and (:query = ''
                   or lower(profile.account.fullName) like lower(concat('%', :query, '%'))
                   or lower(profile.account.email) like lower(concat('%', :query, '%'))
                   or profile.account.phone like concat('%', :query, '%')
                   or lower(profile.employeeCode) like lower(concat('%', :query, '%')))
            """,
            countQuery = """
            select count(profile) from EmployeeProfile profile
            where profile.account.role = 'EMPLOYEE'
              and profile.account.deletedAt is null
              and (:query = ''
                   or lower(profile.account.fullName) like lower(concat('%', :query, '%'))
                   or lower(profile.account.email) like lower(concat('%', :query, '%'))
                   or profile.account.phone like concat('%', :query, '%')
                   or lower(profile.employeeCode) like lower(concat('%', :query, '%')))
            """)
    Page<EmployeeProfile> searchDirectory(@Param("query") String query, Pageable pageable);
}
