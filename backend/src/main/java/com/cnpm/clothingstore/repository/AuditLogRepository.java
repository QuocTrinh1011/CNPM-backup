package com.cnpm.clothingstore.repository;
import com.cnpm.clothingstore.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
public interface AuditLogRepository extends JpaRepository<AuditLog,Long>, JpaSpecificationExecutor<AuditLog> {}
