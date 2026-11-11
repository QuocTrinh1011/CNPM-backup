package com.htttdn.crm.repository;

import com.htttdn.crm.entity.Category;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {
  Optional<Category> findByNameIgnoreCase(String name);
}
