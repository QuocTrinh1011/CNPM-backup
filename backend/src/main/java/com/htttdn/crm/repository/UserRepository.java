package com.htttdn.crm.repository;

import com.htttdn.crm.entity.User; import org.springframework.data.jpa.repository.*; import org.springframework.data.domain.*; import java.util.*;

public interface UserRepository extends JpaRepository<User,Long>, JpaSpecificationExecutor<User> {
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where lower(u.email)=lower(:email)")
    Optional<User> findForPasswordReset(@org.springframework.data.repository.query.Param("email") String email);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.role in ('ADMIN','MANAGER_HR','MANAGER_WAREHOUSE','MANAGER_SALES','EMPLOYEE') order by u.id")
    List<User> lockInternalAccounts();
    @Query("select u from User u where u.role = 'EMPLOYEE' and u.deletedAt is null and (lower(u.fullName) like lower(concat('%', :q, '%')) or lower(u.email) like lower(concat('%', :q, '%'))) ")
    Page<User> findEmployeeDirectory(@org.springframework.data.repository.query.Param("q") String q, Pageable pageable);
    Page<User> findByRoleAndFullNameContainingIgnoreCaseOrRoleAndEmailContainingIgnoreCase(String r1,String n,String r2,String e,Pageable p);
    long countByRole(String role); Optional<User> findByEmailIgnoreCase(String email); boolean existsByEmailIgnoreCase(String email);
    @Query("select u from User u where u.role = 'CUSTOMER' and u.deletedAt is null and (lower(u.fullName) like lower(concat('%', :q, '%')) or lower(u.email) like lower(concat('%', :q, '%')) or u.phone like concat('%', :q, '%'))")
    Page<User> findActiveCustomers(@org.springframework.data.repository.query.Param("q") String q, Pageable pageable);
    long countByRoleAndDeletedAtIsNull(String role);
    long countByRoleAndLockedTrueAndDeletedAtIsNull(String role);
}
