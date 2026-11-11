package com.htttdn.crm.service;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.*;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DirectoryService {
  private final ProductRepository products;
  private final SupplierRepository suppliers;
  private final UserRepository users;

  public DirectoryService(
      ProductRepository products, SupplierRepository suppliers, UserRepository users) {
    this.products = products;
    this.suppliers = suppliers;
    this.users = users;
  }

  private Pageable paging(int page, int size, String sort, boolean desc, Set<String> allowed) {
    if (!allowed.contains(sort) || page < 0 || size < 1 || size > 100)
      throw VoucherService.bad("INVALID_FILTER", "Bộ lọc hoặc phân trang không hợp lệ.");
    return PageRequest.of(
        page,
        size,
        Sort.by(desc ? Sort.Direction.DESC : Sort.Direction.ASC, sort).and(Sort.by("id")));
  }

  public Map<String, Long> overview() {
    return Map.of(
        "accounts",
        users.countByRoleAndDeletedAtIsNull("ADMIN")
            + users.countByRoleAndDeletedAtIsNull("MANAGER"),
        "products",
        products.count(),
        "suppliers",
        suppliers.count());
  }

  public Page<Product> products(
      String q,
      String category,
      Long supplierId,
      BigDecimal minPrice,
      BigDecimal maxPrice,
      String stock,
      Boolean active,
      int page,
      int size,
      String sort,
      boolean desc) {
    return products.findAll(
        (r, x, c) -> {
          List<Predicate> p = new ArrayList<>();
          if (!q.isBlank()) {
            Predicate name = c.like(c.lower(r.get("name")), "%" + q.toLowerCase(Locale.ROOT) + "%");
            try {
              p.add(c.or(name, c.equal(r.get("id"), Long.valueOf(q))));
            } catch (NumberFormatException e) {
              p.add(name);
            }
          }
          if (!category.isBlank()) p.add(c.equal(r.get("categoryEntity").get("name"), category));
          if (supplierId != null) p.add(c.equal(r.get("supplierId"), supplierId));
          if (minPrice != null) p.add(c.greaterThanOrEqualTo(r.get("price"), minPrice));
          if (maxPrice != null) p.add(c.lessThanOrEqualTo(r.get("price"), maxPrice));
          if (active != null) p.add(c.equal(r.get("active"), active));
          if ("IN_STOCK".equals(stock)) p.add(c.greaterThan(r.get("stock"), 0));
          else if ("OUT".equals(stock)) p.add(c.equal(r.get("stock"), 0));
          return c.and(p.toArray(Predicate[]::new));
        },
        paging(page, size, sort, desc, Set.of("name", "price", "stock", "createdAt", "id")));
  }

  public Page<Supplier> suppliers(
      String q, Boolean active, int page, int size, String sort, boolean desc) {
    return suppliers.findAll(
        (r, x, c) -> {
          List<Predicate> match = new ArrayList<>();
          for (String key : List.of("code", "name", "email", "phone"))
            match.add(c.like(c.lower(r.get(key)), "%" + q.toLowerCase(Locale.ROOT) + "%"));
          return c.and(
              c.or(match.toArray(Predicate[]::new)),
              active == null ? c.conjunction() : c.equal(r.get("active"), active));
        },
        paging(page, size, sort, desc, Set.of("name", "createdAt", "id")));
  }

  @Transactional
  public Supplier save(Long id, Supplier input) {
    Supplier s = id == null ? new Supplier() : suppliers.findById(id).orElseThrow();
    String code = input.code.trim().toUpperCase(Locale.ROOT);
    if (!code.matches("[A-Z0-9_-]{1,40}")
        || suppliers.existsByCodeIgnoreCaseAndIdNot(code, id == null ? -1L : id))
      throw VoucherService.bad(
          "INVALID_SUPPLIER_CODE", "Mã nhà cung cấp không hợp lệ hoặc đã tồn tại.");
    s.code = code;
    s.name = input.name.trim();
    s.email = input.email;
    s.phone = input.phone;
    s.address = input.address;
    s.notes = input.notes;
    s.active = input.active;
    return suppliers.save(s);
  }

  @Transactional
  public Product assign(Long productId, Long supplierId) {
    Product p = products.findLockedById(productId).orElseThrow();
    if (supplierId != null && !suppliers.existsById(supplierId))
      throw VoucherService.bad("SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp.");
    p.setSupplierId(supplierId);
    return products.save(p);
  }
}
