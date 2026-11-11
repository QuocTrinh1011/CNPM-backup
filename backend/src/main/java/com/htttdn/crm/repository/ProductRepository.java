package com.htttdn.crm.repository;

import com.htttdn.crm.entity.Product;
import jakarta.persistence.LockModeType;
import java.math.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ProductRepository
    extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
  Page<Product> findByNameContainingIgnoreCaseAndActiveTrue(String n, Pageable p);

  Optional<Product> findByIdAndActiveTrue(Long id);

  long countByActiveTrue();

  @Query(
      "select p from Product p where p.active=true and (:keyword='' or lower(p.name) like"
          + " lower(concat('%',:keyword,'%')) or lower(p.categoryEntity.name) like"
          + " lower(concat('%',:keyword,'%'))) and (:category='' or"
          + " p.categoryEntity.name=:category) and (:gender='' or p.gender=:gender) and (:minPrice"
          + " is null or coalesce(p.salePrice,p.price)>=:minPrice) and (:maxPrice is null or"
          + " coalesce(p.salePrice,p.price)<=:maxPrice)")
  Page<Product> searchCatalog(
      @Param("keyword") String keyword,
      @Param("category") String category,
      @Param("gender") String gender,
      @Param("minPrice") BigDecimal minPrice,
      @Param("maxPrice") BigDecimal maxPrice,
      Pageable pageable);

  @Query(
      "select distinct p.categoryEntity.name from Product p where p.active=true and"
          + " p.categoryEntity is not null order by p.categoryEntity.name")
  List<String> findActiveCategories();

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select p from Product p where p.id=:id")
  Optional<Product> findLockedById(@Param("id") Long id);
}
