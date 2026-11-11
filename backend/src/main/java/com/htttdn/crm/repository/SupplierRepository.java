package com.htttdn.crm.repository;

import com.htttdn.crm.entity.Supplier;
import org.springframework.data.jpa.repository.*;

public interface SupplierRepository
    extends JpaRepository<Supplier, Long>, JpaSpecificationExecutor<Supplier> {
  boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);
}
