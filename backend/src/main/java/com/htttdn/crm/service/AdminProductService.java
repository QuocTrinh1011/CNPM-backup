package com.htttdn.crm.service;

import com.htttdn.crm.dto.admin.AdminDtos.ProductRequest;
import com.htttdn.crm.dto.admin.AdminDtos.StockRequest;
import com.htttdn.crm.entity.Category;
import com.htttdn.crm.entity.Product;
import com.htttdn.crm.repository.CategoryRepository;
import com.htttdn.crm.repository.ProductRepository;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminProductService extends AdminServiceSupport {
  private final ProductRepository products;
  private final CategoryRepository categories;

  public AdminProductService(ProductRepository products, CategoryRepository categories) {
    this.products = products;
    this.categories = categories;
  }

  public Page<Product> list(String q, int page, int size) {
    return products.findByNameContainingIgnoreCaseAndActiveTrue(q, page(page, size));
  }

  public Page<Product> search(
      String q,
      String category,
      java.math.BigDecimal minPrice,
      java.math.BigDecimal maxPrice,
      String stock,
      String active,
      String sort,
      String direction,
      int page,
      int size) {
    if (page < 0
        || size < 1
        || size > 100
        || q.length() > 120
        || minPrice != null && minPrice.signum() < 0
        || maxPrice != null && maxPrice.signum() < 0
        || minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0
        || !java.util.Set.of("ALL", "AVAILABLE", "OUT").contains(stock)
        || !java.util.Set.of("ALL", "true", "false").contains(active)
        || !java.util.Set.of("name", "price", "stock", "createdAt").contains(sort)
        || !java.util.Set.of("ASC", "DESC").contains(direction.toUpperCase(java.util.Locale.ROOT)))
      throw new com.htttdn.crm.exception.ApiException(
          org.springframework.http.HttpStatus.BAD_REQUEST,
          "INVALID_FILTER",
          "Bộ lọc sản phẩm không hợp lệ.");
    return products.findAll(
        (root, query, cb) -> {
          if (query.getResultType() != Long.class)
            root.fetch("categoryEntity", jakarta.persistence.criteria.JoinType.LEFT);
          var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
          if (!q.isBlank()) {
            String pattern =
                "%"
                    + q.trim()
                        .toLowerCase(java.util.Locale.ROOT)
                        .replace("!", "!!")
                        .replace("%", "!%")
                        .replace("_", "!_")
                    + "%";
            predicates.add(
                cb.or(
                    cb.like(cb.lower(root.get("name")), pattern, '!'),
                    cb.like(cb.lower(root.get("categoryEntity").get("name")), pattern, '!')));
          }
          if (category != null && !category.isBlank())
            predicates.add(cb.equal(root.get("categoryEntity").get("name"), category));
          if (minPrice != null)
            predicates.add(cb.greaterThanOrEqualTo(root.get("price"), minPrice));
          if (maxPrice != null) predicates.add(cb.lessThanOrEqualTo(root.get("price"), maxPrice));
          if (!"ALL".equals(active))
            predicates.add(cb.equal(root.get("active"), Boolean.parseBoolean(active)));
          if ("AVAILABLE".equals(stock)) predicates.add(cb.greaterThan(root.get("stock"), 0));
          if ("OUT".equals(stock)) predicates.add(cb.equal(root.get("stock"), 0));
          return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        },
        org.springframework.data.domain.PageRequest.of(
            page,
            size,
            org.springframework.data.domain.Sort.by(
                    org.springframework.data.domain.Sort.Direction.fromString(direction), sort)
                .and(org.springframework.data.domain.Sort.by("id").descending())));
  }

  public java.util.List<String> categoryNames() {
    return categories.findAll().stream().map(Category::getName).sorted().toList();
  }

  @Transactional
  public Product create(ProductRequest request) {
    Product product = new Product();
    copy(product, request);
    products.save(product);
    audit("CREATE", "PRODUCT", product.getId(), java.util.Map.of(), product);
    return product;
  }

  @Transactional
  public Product update(Long id, ProductRequest request) {
    Product product = get(id);
    var before = snapshot(product);
    copy(product, request);
    product.setUpdatedAt(Instant.now());
    audit("UPDATE", "PRODUCT", id, before, product);
    return products.save(product);
  }

  @Transactional
  public void archive(Long id) {
    Product product = get(id);
    var before = snapshot(product);
    product.setActive(false);
    products.save(product);
    if (!before.equals(snapshot(product))) audit("ARCHIVE", "PRODUCT", id, before, product);
  }

  @Transactional
  public Product stock(Long id, StockRequest request) {
    Product product = get(id);
    var before = snapshot(product);
    product.setStock(request.quantity());
    product.setUpdatedAt(Instant.now());
    if (!before.equals(snapshot(product))) audit("STOCK", "PRODUCT", id, before, product);
    return products.save(product);
  }

  private Product get(Long id) {
    return products.findById(id).orElseThrow();
  }

  private void copy(Product p, ProductRequest r) {
    p.setName(r.name());
    if (r.category() != null && !r.category().isBlank()) {
      Category category =
          categories
              .findByNameIgnoreCase(r.category().trim())
              .orElseGet(
                  () -> {
                    Category created = new Category();
                    created.setName(r.category().trim());
                    return categories.save(created);
                  });
      p.setCategoryEntity(category);
    }
    p.setDescription(r.description());
    p.setPrice(r.price());
    p.setStock(r.stock());
    p.setImageUrl(r.imageUrl());
  }
}
