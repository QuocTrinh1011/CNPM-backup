package com.htttdn.crm.controller;

import com.htttdn.crm.dto.admin.AdminDtos.*;
import com.htttdn.crm.entity.Product;
import com.htttdn.crm.service.AdminProductService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manager/products")
public class AdminProductController {
  private final AdminProductService service;

  public AdminProductController(AdminProductService service) {
    this.service = service;
  }

  @GetMapping
  public Page<Product> list(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String category,
      @RequestParam(required = false) java.math.BigDecimal minPrice,
      @RequestParam(required = false) java.math.BigDecimal maxPrice,
      @RequestParam(defaultValue = "ALL") String stock,
      @RequestParam(defaultValue = "true") String active,
      @RequestParam(defaultValue = "createdAt") String sort,
      @RequestParam(defaultValue = "DESC") String direction,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.search(
        q, category, minPrice, maxPrice, stock, active, sort, direction, page, size);
  }

  @GetMapping("/categories")
  public java.util.List<String> categories() {
    return service.categoryNames();
  }

  @PostMapping
  public Product create(@Valid @RequestBody ProductRequest r) {
    return service.create(r);
  }

  @PutMapping("/{id}")
  public Product update(@PathVariable Long id, @Valid @RequestBody ProductRequest r) {
    return service.update(id, r);
  }

  @DeleteMapping("/{id}")
  public void archive(@PathVariable Long id) {
    service.archive(id);
  }

  @PatchMapping("/{id}/stock")
  public Product stock(@PathVariable Long id, @Valid @RequestBody StockRequest r) {
    return service.stock(id, r);
  }
}
