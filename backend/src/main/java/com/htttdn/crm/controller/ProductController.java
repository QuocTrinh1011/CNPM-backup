package com.htttdn.crm.controller;

import com.htttdn.crm.entity.Product;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.ProductRepository;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
public class ProductController {
  private final ProductRepository products;

  public ProductController(ProductRepository products) {
    this.products = products;
  }

  @GetMapping
  public Page<Product> catalog(
      @RequestParam(defaultValue = "") String keyword,
      @RequestParam(defaultValue = "") String category,
      @RequestParam(defaultValue = "NAM") String gender,
      @RequestParam(required = false) BigDecimal minPrice,
      @RequestParam(required = false) BigDecimal maxPrice,
      @RequestParam(defaultValue = "newest") String sort,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "12") int size) {
    if (page < 0
        || size < 1
        || size > 48
        || minPrice != null && minPrice.signum() < 0
        || maxPrice != null && maxPrice.signum() < 0
        || (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0))
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER", "Khoảng giá chưa hợp lệ.");
    Sort ordering =
        switch (sort) {
          case "price_asc" -> Sort.by("salePrice").ascending();
          case "price_desc" -> Sort.by("salePrice").descending();
          case "oldest" -> Sort.by("createdAt").ascending();
          default -> Sort.by("createdAt").descending();
        };
    return products.searchCatalog(
        keyword.trim(),
        category.trim(),
        gender.trim(),
        minPrice,
        maxPrice,
        PageRequest.of(page, size, ordering));
  }

  @GetMapping("/categories")
  public List<String> categories() {
    return products.findActiveCategories();
  }

  @GetMapping("/{id}")
  public Product detail(@PathVariable Long id) {
    return products
        .findByIdAndActiveTrue(id)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm."));
  }
}
