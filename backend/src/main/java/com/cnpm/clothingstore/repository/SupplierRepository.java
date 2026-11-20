package com.cnpm.clothingstore.repository;
import com.cnpm.clothingstore.entity.Supplier;
import org.springframework.data.jpa.repository.*;
public interface SupplierRepository extends JpaRepository<Supplier,Long>,JpaSpecificationExecutor<Supplier>{boolean existsByCodeIgnoreCaseAndIdNot(String code,Long id);}
