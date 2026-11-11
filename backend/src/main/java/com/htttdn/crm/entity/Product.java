package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "products")
public class Product {
  private Long supplierId;

  public Long getSupplierId() {
    return supplierId;
  }

  public void setSupplierId(Long value) {
    supplierId = value;
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "product_id")
  private Long id;

  @Column(nullable = false, length = 150)
  private String name;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "category_id", nullable = false)
  @JsonIgnore
  private Category categoryEntity;

  @Column(name = "gender", length = 20)
  private String gender = "NAM";

  @Column(length = 4000)
  private String description;

  private String material;

  @Column(name = "size", length = 1000)
  private String sizes = "S,M,L,XL,XXL";

  @Column(name = "color", length = 1000)
  private String colors = "Đen,Be,Xám";

  @Column(nullable = false, precision = 15, scale = 2)
  private BigDecimal price;

  @Column(name = "sale_price", precision = 15, scale = 2)
  private BigDecimal salePrice;

  @Column(name = "quantity_remaining", nullable = false)
  private int stock;

  @Column(name = "image_url", length = 2000)
  private String imageUrl;

  private String badge;
  private boolean featured = false;
  private boolean active = true;

  @Column(name = "created_at")
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at")
  private Instant updatedAt = Instant.now();

  public Product() {}

  public Long getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public void setName(String value) {
    name = value;
  }

  @JsonProperty("category")
  public String getCategory() {
    return categoryEntity == null ? null : categoryEntity.getName();
  }

  public void setCategoryEntity(Category value) {
    categoryEntity = value;
  }

  @JsonIgnore
  public Category getCategoryEntity() {
    return categoryEntity;
  }

  public String getGender() {
    return gender;
  }

  public void setGender(String value) {
    gender = value;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String value) {
    description = value;
  }

  public String getMaterial() {
    return material;
  }

  public void setMaterial(String value) {
    material = value;
  }

  public String getSizes() {
    return sizes;
  }

  public void setSizes(String value) {
    sizes = value;
  }

  public String getColors() {
    return colors;
  }

  public void setColors(String value) {
    colors = value;
  }

  public BigDecimal getPrice() {
    return price;
  }

  public void setPrice(BigDecimal value) {
    price = value;
  }

  public BigDecimal getSalePrice() {
    return salePrice;
  }

  public void setSalePrice(BigDecimal value) {
    salePrice = value;
  }

  public int getStock() {
    return stock;
  }

  public void setStock(int value) {
    stock = value;
  }

  public String getImageUrl() {
    return imageUrl;
  }

  public void setImageUrl(String value) {
    imageUrl = value;
  }

  public String getBadge() {
    return badge;
  }

  public void setBadge(String value) {
    badge = value;
  }

  public boolean isFeatured() {
    return featured;
  }

  public void setFeatured(boolean value) {
    featured = value;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean value) {
    active = value;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant value) {
    createdAt = value;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant value) {
    updatedAt = value;
  }
}
