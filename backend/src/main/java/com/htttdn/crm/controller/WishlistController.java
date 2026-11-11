package com.htttdn.crm.controller;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.*;
import com.htttdn.crm.service.AuthService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wishlist")
public class WishlistController {
  private final AuthService auth;
  private final WishlistRepository wishlists;
  private final ProductRepository products;

  public WishlistController(
      AuthService auth, WishlistRepository wishlists, ProductRepository products) {
    this.auth = auth;
    this.wishlists = wishlists;
    this.products = products;
  }

  @GetMapping
  public List<WishlistView> list(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    return wishlists
        .findByCustomerIdOrderByCreatedAtDesc(auth.requireCustomer(authorization).getId())
        .stream()
        .map(this::view)
        .toList();
  }

  @PostMapping("/{productId}")
  public ResponseEntity<WishlistView> add(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long productId) {
    User customer = auth.requireCustomer(authorization);
    Product product =
        products
            .findByIdAndActiveTrue(productId)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm."));
    WishlistItem item =
        wishlists
            .findByCustomerIdAndProductId(customer.getId(), productId)
            .orElseGet(
                () -> {
                  WishlistItem x = new WishlistItem();
                  x.setCustomer(customer);
                  x.setProduct(product);
                  x.setCreatedAt(Instant.now());
                  return x;
                });
    return ResponseEntity.status(HttpStatus.CREATED).body(view(wishlists.save(item)));
  }

  @DeleteMapping("/{productId}")
  public ResponseEntity<Void> remove(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable Long productId) {
    wishlists
        .findByCustomerIdAndProductId(auth.requireCustomer(authorization).getId(), productId)
        .ifPresent(wishlists::delete);
    return ResponseEntity.noContent().build();
  }

  private WishlistView view(WishlistItem item) {
    Product p = item.getProduct();
    return new WishlistView(
        item.getId(),
        p.getId(),
        p.getName(),
        p.getImageUrl(),
        p.getPrice(),
        p.getSalePrice(),
        p.getCategory(),
        p.getStock(),
        p.getSizes(),
        p.getColors());
  }

  public record WishlistView(
      Long id,
      Long productId,
      String name,
      String imageUrl,
      BigDecimal price,
      BigDecimal salePrice,
      String category,
      int stock,
      String sizes,
      String colors) {}
}
