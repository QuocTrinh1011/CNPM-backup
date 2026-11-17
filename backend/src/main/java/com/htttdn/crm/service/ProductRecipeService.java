package com.htttdn.crm.service;

import com.htttdn.crm.entity.Product;
import com.htttdn.crm.entity.ProductRecipe;
import com.htttdn.crm.entity.ProductRecipeItem;
import com.htttdn.crm.entity.RawMaterial;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.ProductRecipeRepository;
import com.htttdn.crm.repository.ProductRepository;
import com.htttdn.crm.repository.RawMaterialRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductRecipeService {
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999999.999");
    private final ProductRepository products;
    private final RawMaterialRepository materials;
    private final ProductRecipeRepository recipes;
    private final AuditTrail audit;

    public ProductRecipeService(ProductRepository products, RawMaterialRepository materials,
                                ProductRecipeRepository recipes, AuditTrail audit) {
        this.products = products;
        this.materials = materials;
        this.recipes = recipes;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public RecipeView get(Long productId) {
        Product product = products.findById(productId)
                .orElseThrow(() -> notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm."));
        return recipes.findFirstByProduct_IdAndActiveTrue(productId)
                .map(ProductRecipeService::view)
                .orElseGet(() -> new RecipeView(product.getId(), product.getName(), null, 0, false, null, List.of()));
    }

    @Transactional
    public RecipeView createVersion(Long productId, RecipeRequest request) {
        if (productId == null || productId < 1 || request == null || request.items() == null
                || request.items().isEmpty() || request.items().size() > 100) {
            throw invalid("Công thức phải có ít nhất một nguyên liệu.");
        }
        Product product = products.findLockedById(productId).filter(Product::isActive)
                .orElseThrow(() -> notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm đang kinh doanh."));
        AuditTrail.Actor actor = AuditTrail.actor();
        if (actor == null || actor.id() == null) throw new IllegalStateException("Authenticated warehouse actor required");

        List<RecipeItemInput> requestedItems = request.items();
        Set<Long> materialIds = new HashSet<>();
        for (RecipeItemInput item : requestedItems) validateItem(item, materialIds);
        List<RecipeItemInput> orderedItems = requestedItems.stream()
                .sorted(Comparator.comparing(RecipeItemInput::materialId)).toList();

        Map<Long, RawMaterial> lockedMaterials = new LinkedHashMap<>();
        for (RecipeItemInput item : orderedItems) {
            RawMaterial material = materials.findByIdForUpdate(item.materialId()).filter(RawMaterial::isActive)
                    .orElseThrow(() -> notFound("RAW_MATERIAL_NOT_FOUND", "Không tìm thấy nguyên liệu đang hoạt động."));
            lockedMaterials.put(material.getId(), material);
        }

        ProductRecipe current = recipes.findFirstByProduct_IdAndActiveTrue(productId).orElse(null);
        int previousVersion = current == null ? 0 : current.getVersion();
        if (current != null) {
            current.setActive(false);
            recipes.saveAndFlush(current);
        }
        int latestVersion = recipes.findFirstByProduct_IdOrderByVersionDesc(productId)
                .map(ProductRecipe::getVersion).orElse(0);
        if (latestVersion == Integer.MAX_VALUE) throw invalid("Đã vượt số phiên bản công thức cho phép.");

        ProductRecipe recipe = new ProductRecipe();
        recipe.setProduct(product);
        recipe.setVersion(latestVersion + 1);
        recipe.setActive(true);
        recipe.setCreatedBy(actor.id());
        recipe.setCreatedAt(Instant.now());
        for (RecipeItemInput input : orderedItems) {
            RawMaterial material = lockedMaterials.get(input.materialId());
            ProductRecipeItem item = new ProductRecipeItem();
            item.setMaterial(material);
            item.setMaterialCode(material.getCode());
            item.setMaterialName(material.getName());
            item.setUnit(material.getUnit());
            item.setQuantityPerProduct(input.quantityPerProduct().setScale(3, RoundingMode.UNNECESSARY));
            recipe.addItem(item);
        }
        ProductRecipe saved = recipes.saveAndFlush(recipe);
        audit.record("CREATE_VERSION", "PRODUCT_RECIPE", saved.getId(),
                previousVersion == 0 ? Map.of() : Map.of("version", previousVersion),
                Map.of("productId", productId, "version", saved.getVersion(), "itemCount", saved.getItems().size()));
        return view(saved);
    }

    private static void validateItem(RecipeItemInput item, Set<Long> materialIds) {
        if (item == null || item.materialId() == null || item.materialId() < 1
                || item.quantityPerProduct() == null || item.quantityPerProduct().signum() <= 0
                || item.quantityPerProduct().scale() > 3 || item.quantityPerProduct().precision() > 15
                || item.quantityPerProduct().compareTo(MAX_QUANTITY) > 0 || !materialIds.add(item.materialId())) {
            throw invalid("Mỗi nguyên liệu chỉ được xuất hiện một lần; định mức phải dương và tối đa 3 số thập phân.");
        }
    }

    private static RecipeView view(ProductRecipe recipe) {
        List<RecipeItemView> items = recipe.getItems().stream()
                .map(item -> new RecipeItemView(item.getId(), item.getMaterial().getId(), item.getMaterialCode(),
                        item.getMaterialName(), item.getUnit(), item.getQuantityPerProduct()))
                .toList();
        return new RecipeView(recipe.getProduct().getId(), recipe.getProduct().getName(), recipe.getId(),
                recipe.getVersion(), recipe.isActive(), recipe.getCreatedAt(), items);
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PRODUCT_RECIPE", message);
    }

    private static ApiException notFound(String code, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message);
    }

    public record RecipeRequest(@NotEmpty @Size(max = 100) List<@NotNull @Valid RecipeItemInput> items) {}
    public record RecipeItemInput(@NotNull @Positive Long materialId,
                                  @NotNull @DecimalMin(value = "0.000", inclusive = false)
                                  @Digits(integer = 12, fraction = 3) BigDecimal quantityPerProduct) {}
    public record RecipeItemView(Long id, Long materialId, String materialCode, String materialName,
                                 String unit, BigDecimal quantityPerProduct) {}
    public record RecipeView(Long productId, String productName, Long recipeId, int version, boolean active,
                             Instant createdAt, List<RecipeItemView> items) {}
}
