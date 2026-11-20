package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.ProductRecipe;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRecipeRepository extends JpaRepository<ProductRecipe, Long> {
    Optional<ProductRecipe> findFirstByProduct_IdAndActiveTrue(Long productId);

    Optional<ProductRecipe> findFirstByProduct_IdOrderByVersionDesc(Long productId);

    @EntityGraph(attributePaths = {"product", "items", "items.material"})
    List<ProductRecipe> findAllByProduct_IdOrderByVersionAsc(Long productId);

}
