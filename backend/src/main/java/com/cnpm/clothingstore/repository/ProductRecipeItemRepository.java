package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.ProductRecipeItem;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRecipeItemRepository extends JpaRepository<ProductRecipeItem, Long> {
    @EntityGraph(attributePaths = "material")
    List<ProductRecipeItem> findByRecipe_IdOrderByIdAsc(Long recipeId);
}
