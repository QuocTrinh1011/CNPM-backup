package com.htttdn.crm.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.htttdn.crm.entity.Category;
import com.htttdn.crm.entity.Product;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@DataJpaTest(
    properties = {
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.sql.init.mode=never"
    })
class ProductCatalogSearchTest {
  @Autowired TestEntityManager em;
  @Autowired ProductRepository products;

  Category category(String name) {
    Category c = new Category();
    c.setName(name);
    return em.persist(c);
  }

  Product product(String name, Category category, String description, int price, boolean active) {
    Product p = new Product();
    p.setName(name);
    p.setCategoryEntity(category);
    p.setDescription(description);
    p.setPrice(BigDecimal.valueOf(price));
    p.setActive(active);
    p.setStock(5);
    return em.persist(p);
  }

  @Test
  void searchesNameAndCategoryButNotStylingSuggestionsBeforePagination() {
    Category pants = category("Quần"), jackets = category("Áo khoác");
    product("Áo khoác denim Trucker", jackets, "Kết hợp cùng áo thun và quần kaki.", 999000, true);
    Product denim = product("Quần relaxed denim Nhật", pants, "", 649000, true);
    Product cargo = product("Cargo tapered Flex", pants, "", 699000, true);
    product("Quần đã ẩn", pants, "", 100000, false);
    em.flush();
    em.clear();
    var first =
        products.searchCatalog(
            "QUẦN", "", "NAM", null, null, PageRequest.of(0, 1, Sort.by("price")));
    assertThat(first.getTotalElements()).isEqualTo(2);
    assertThat(first.getTotalPages()).isEqualTo(2);
    assertThat(first.getContent()).extracting(Product::getId).containsExactly(denim.getId());
    var second =
        products.searchCatalog(
            "quần", "", "NAM", null, null, PageRequest.of(1, 1, Sort.by("price")));
    assertThat(second.getContent()).extracting(Product::getId).containsExactly(cargo.getId());
    assertThat(products.searchCatalog("quần", "Áo khoác", "NAM", null, null, PageRequest.of(0, 10)))
        .isEmpty();
    assertThat(
            products
                .searchCatalog(
                    "quần", "", "NAM", BigDecimal.valueOf(680000), null, PageRequest.of(0, 10))
                .getContent())
        .extracting(Product::getId)
        .containsExactly(cargo.getId());
    assertThat(products.searchCatalog("không có", "", "NAM", null, null, PageRequest.of(0, 10)))
        .isEmpty();
  }
}
