package com.cnpm.clothingstore.service.order;

import com.cnpm.clothingstore.entity.*;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;

import java.math.*;
import java.time.*;
import java.util.*;
import com.cnpm.clothingstore.service.*;
import com.cnpm.clothingstore.service.OrderService.*;

public final class OrderInput {
    public static void validateVariant(Product product, String size, String color) { if (!hasOption(product.getSizes(), size) || !hasOption(product.getColors(), color)) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_VARIANT", "Size hoặc màu sản phẩm không hợp lệ."); }

    public static boolean hasOption(String csv, String value) { return value == null || value.isBlank() || Arrays.stream(String.valueOf(csv == null ? "" : csv).split(",")).map(String::trim).anyMatch(value.trim()::equalsIgnoreCase); }

    public static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    public static ApiException invalidCart() { return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CART", "Sản phẩm trong giỏ không còn hợp lệ."); }
}
