package com.htttdn.crm.repository;

import com.htttdn.crm.entity.ProductRecipeItem;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRecipeItemRepository extends JpaRepository<ProductRecipeItem, Long> {
    @EntityGraph(attributePaths = "material")
    List<ProductRecipeItem> findByRecipe_IdOrderByIdAsc(Long recipeId);
}
