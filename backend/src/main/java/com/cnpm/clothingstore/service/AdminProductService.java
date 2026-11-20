package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.dto.admin.AdminDtos.ProductRequest;
import com.cnpm.clothingstore.dto.admin.AdminDtos.StockRequest;
import com.cnpm.clothingstore.entity.Category;
import com.cnpm.clothingstore.entity.InventoryItemType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.entity.Product;
import com.cnpm.clothingstore.repository.CategoryRepository;
import com.cnpm.clothingstore.repository.ProductRepository;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class AdminProductService extends AdminServiceSupport {
    private final ProductRepository products;
    private final CategoryRepository categories;
    private final InventoryMovementService movements;
    public AdminProductService(ProductRepository products, CategoryRepository categories,
                               InventoryMovementService movements) {
        this.products = products;
        this.categories = categories;
        this.movements = movements;
    }
    public Page<Product> list(String q, int page, int size) { return products.findByNameContainingIgnoreCaseAndActiveTrue(q, page(page, size)); }
    public Page<Product> search(String q,String category,java.math.BigDecimal minPrice,java.math.BigDecimal maxPrice,String stock,String active,String sort,String direction,int page,int size){
        if(page<0||size<1||size>100||q.length()>120||minPrice!=null&&minPrice.signum()<0||maxPrice!=null&&maxPrice.signum()<0||minPrice!=null&&maxPrice!=null&&minPrice.compareTo(maxPrice)>0||!java.util.Set.of("ALL","AVAILABLE","OUT").contains(stock)||!java.util.Set.of("ALL","true","false").contains(active)||!java.util.Set.of("name","price","stock","createdAt").contains(sort)||!java.util.Set.of("ASC","DESC").contains(direction.toUpperCase(java.util.Locale.ROOT)))
            throw new com.cnpm.clothingstore.exception.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,"INVALID_FILTER","Bộ lọc sản phẩm không hợp lệ.");
        return products.findAll((root,query,cb)->{
            if(query.getResultType()!=Long.class)root.fetch("categoryEntity",jakarta.persistence.criteria.JoinType.LEFT);
            var predicates=new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if(!q.isBlank()){String pattern="%"+q.trim().toLowerCase(java.util.Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%";predicates.add(cb.or(cb.like(cb.lower(root.get("name")),pattern,'!'),cb.like(cb.lower(root.get("categoryEntity").get("name")),pattern,'!')));}
            if(category!=null&&!category.isBlank())predicates.add(cb.equal(root.get("categoryEntity").get("name"),category));
            if(minPrice!=null)predicates.add(cb.greaterThanOrEqualTo(root.get("price"),minPrice));if(maxPrice!=null)predicates.add(cb.lessThanOrEqualTo(root.get("price"),maxPrice));
            if(!"ALL".equals(active))predicates.add(cb.equal(root.get("active"),Boolean.parseBoolean(active)));
            if("AVAILABLE".equals(stock))predicates.add(cb.greaterThan(root.get("stock"),0));if("OUT".equals(stock))predicates.add(cb.equal(root.get("stock"),0));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        },org.springframework.data.domain.PageRequest.of(page,size,org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.fromString(direction),sort).and(org.springframework.data.domain.Sort.by("id").descending())));
    }
    public java.util.List<String> categoryNames(){return categories.findAll().stream().map(Category::getName).sorted().toList();}
    @Transactional public Product create(ProductRequest request) {
        Product product = new Product();
        copy(product, request);
        products.save(product);
        audit("CREATE", "PRODUCT", product.getId(), java.util.Map.of(), product);
        movements.recordChange(InventoryItemType.PRODUCT, product.getId(), InventoryLocation.SELLABLE, null,
                stockQuantity(product.getStock()), stockQuantity(product.getStock()), InventoryMovementType.OPENING,
                "PRODUCT_CREATE", product.getId());
        return product;
    }
    @Transactional public Product update(Long id, ProductRequest request) {
        Product product = getForUpdate(id);
        int beforeStock = product.getStock();
        var before = snapshot(product);
        copy(product, request);
        product.setUpdatedAt(Instant.now());
        Product saved = products.save(product);
        Long auditId = audit("UPDATE", "PRODUCT", id, before, product);
        recordAdjustmentIfChanged(product, beforeStock, auditId);
        return saved;
    }
    @Transactional public void archive(Long id) { Product product = get(id);var before=snapshot(product); product.setActive(false); products.save(product);if(!before.equals(snapshot(product)))audit("ARCHIVE","PRODUCT",id,before,product); }
    @Transactional public Product stock(Long id, StockRequest request) {
        Product product = getForUpdate(id);
        int beforeStock = product.getStock();
        var before = snapshot(product);
        product.setStock(request.quantity());
        product.setUpdatedAt(Instant.now());
        if (!before.equals(snapshot(product))) {
            Long auditId = audit("STOCK", "PRODUCT", id, before, product);
            recordAdjustmentIfChanged(product, beforeStock, auditId);
        }
        return products.save(product);
    }
    public Product get(Long id) { return products.findById(id).orElseThrow(); }
    private Product getForUpdate(Long id) {
        return products.findLockedById(id).orElseThrow();
    }
    private void recordAdjustmentIfChanged(Product product, int beforeStock, Long auditId) {
        int delta = product.getStock() - beforeStock;
        if (delta == 0) return;
        if (auditId == null) throw new IllegalStateException("Stock adjustments must have a verified audit event");
        movements.recordChangeAs(AuditTrail.actor(), InventoryItemType.PRODUCT, product.getId(),
                InventoryLocation.SELLABLE, null, stockQuantity(delta), stockQuantity(product.getStock()),
                InventoryMovementType.SELLABLE_ADJUSTMENT, "AUDIT_LOG", auditId);
    }
    private static java.math.BigDecimal stockQuantity(int quantity) {
        return java.math.BigDecimal.valueOf(quantity).setScale(3);
    }
    private void copy(Product p, ProductRequest r) {
        p.setName(r.name());
        if (r.category() != null && !r.category().isBlank()) {
            Category category = categories.findByNameIgnoreCase(r.category().trim())
                    .orElseGet(() -> {
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

        String existingColors = p.getColors();
        String colors = r.colors() == null ? existingColors : r.colors();
        if (r.colors() != null) p.setColors(r.colors());
        if (r.colorImages() != null) {
            Map<String, List<String>> colorImages = validateColorImages(colors, r.colorImages());
            p.setColorImages(colorImages);
            String defaultColor = firstColor(colors);
            List<String> defaultImages = colorImages.get(defaultColor);
            if (defaultImages == null || defaultImages.isEmpty()) {
                defaultImages = colorImages.values().stream().filter(images -> !images.isEmpty()).findFirst().orElse(List.of());
            }
            if (!defaultImages.isEmpty()) p.setImageUrl(defaultImages.getFirst());
        } else if (r.colors() != null && !Objects.equals(r.colors(), existingColors)) {
            p.setColorImages(validateColorImages(colors, p.getColorImages()));
        }
    }

    private Map<String, List<String>> validateColorImages(String colors, Map<String, List<String>> imagesByColor) {
        Set<String> allowedColors = new LinkedHashSet<>();
        for (String color : colors == null ? new String[0] : colors.split(",", -1)) {
            String normalized = color.trim();
            if (!normalized.isEmpty()) allowedColors.add(normalized);
        }

        Map<String, List<String>> normalizedImages = new LinkedHashMap<>();
        if (imagesByColor == null) return normalizedImages;
        for (Map.Entry<String, List<String>> entry : imagesByColor.entrySet()) {
            String color = entry.getKey() == null ? "" : entry.getKey().trim();
            List<String> urls = entry.getValue();
            if (!allowedColors.contains(color) || normalizedImages.containsKey(color)
                    || urls == null || urls.isEmpty() || urls.size() > 6) {
                throw invalidColorImages();
            }
            List<String> normalizedUrls = new ArrayList<>();
            for (String url : urls) {
                String normalizedUrl = url == null ? "" : url.trim();
                if (normalizedUrl.isEmpty() || !isAllowedProductImageUrl(normalizedUrl)) throw invalidColorImages();
                normalizedUrls.add(normalizedUrl);
            }
            normalizedImages.put(color, List.copyOf(normalizedUrls));
        }
        return normalizedImages;
    }

    private boolean isAllowedProductImageUrl(String value) {
        if (value.startsWith("/") && !value.startsWith("//")) return true;
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private String firstColor(String colors) {
        if (colors == null) return "";
        return java.util.Arrays.stream(colors.split(",", -1)).map(String::trim).filter(color -> !color.isEmpty()).findFirst().orElse("");
    }

    private com.cnpm.clothingstore.exception.ApiException invalidColorImages() {
        return new com.cnpm.clothingstore.exception.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,
                "INVALID_PRODUCT_COLOR_IMAGES", "Ảnh theo màu sản phẩm chưa hợp lệ.");
    }
}
