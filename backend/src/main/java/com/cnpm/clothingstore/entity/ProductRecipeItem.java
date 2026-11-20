package com.cnpm.clothingstore.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "product_recipe_items")
public class ProductRecipeItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_id", nullable = false)
    private ProductRecipe recipe;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    private RawMaterial material;

    @Column(name = "material_code", nullable = false, length = 40)
    private String materialCode;

    @Column(name = "material_name", nullable = false, length = 150)
    private String materialName;

    @Column(nullable = false, length = 24)
    private String unit;

    @Column(name = "quantity_per_product", nullable = false, precision = 15, scale = 3)
    private BigDecimal quantityPerProduct;

    public Long getId() { return id; }
    public ProductRecipe getRecipe() { return recipe; }
    public void setRecipe(ProductRecipe recipe) { this.recipe = recipe; }
    public RawMaterial getMaterial() { return material; }
    public void setMaterial(RawMaterial material) { this.material = material; }
    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
    public String getMaterialName() { return materialName; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getQuantityPerProduct() { return quantityPerProduct; }
    public void setQuantityPerProduct(BigDecimal quantityPerProduct) { this.quantityPerProduct = quantityPerProduct; }
}
