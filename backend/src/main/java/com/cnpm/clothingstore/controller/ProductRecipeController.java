package com.cnpm.clothingstore.controller;

import com.cnpm.clothingstore.service.ProductRecipeService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/manager/products/{productId}/recipe")
public class ProductRecipeController {
    private final ProductRecipeService recipes;

    public ProductRecipeController(ProductRecipeService recipes) { this.recipes = recipes; }

    @GetMapping
    public ProductRecipeService.RecipeView get(@PathVariable Long productId) {
        return recipes.get(productId);
    }

    @PutMapping
    public ProductRecipeService.RecipeView createVersion(@PathVariable Long productId,
                                                          @Valid @RequestBody ProductRecipeService.RecipeRequest request) {
        return recipes.createVersion(productId, request);
    }
}
