package com.htttdn.crm.controller;

import com.htttdn.crm.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
public class CartController {
  private final AuthService auth;
  private final CartService cart;

  public CartController(AuthService auth, CartService cart) {
    this.auth = auth;
    this.cart = cart;
  }

  @GetMapping
  public CartService.CartSummary get(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    return cart.get(auth.requireCustomer(authorization));
  }

  @PutMapping
  public CartService.CartSummary replace(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody CartRequest request) {
    return cart.replace(
        auth.requireCustomer(authorization), request.items() == null ? List.of() : request.items());
  }

  @PostMapping("/items")
  public CartService.CartSummary add(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody AddRequest request) {
    return cart.add(
        auth.requireCustomer(authorization),
        request.productId(),
        request.quantity(),
        request.size(),
        request.color());
  }

  public record CartRequest(List<CartService.LineRequest> items) {}

  public record AddRequest(
      @NotNull Long productId, @Min(1) int quantity, String size, String color) {}
}
