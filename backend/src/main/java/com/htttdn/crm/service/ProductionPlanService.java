package com.htttdn.crm.service;

import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.Product;
import com.htttdn.crm.entity.ProductRecipe;
import com.htttdn.crm.entity.ProductRecipeItem;
import com.htttdn.crm.entity.ProductionPlan;
import com.htttdn.crm.entity.ProductionPlanMaterial;
import com.htttdn.crm.entity.RawMaterial;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.EmployeeProfileRepository;
import com.htttdn.crm.repository.MaterialIssueRequestRepository;
import com.htttdn.crm.repository.MaterialReturnRepository;
import com.htttdn.crm.repository.ProductRecipeRepository;
import com.htttdn.crm.repository.ProductRepository;
import com.htttdn.crm.repository.ProductionPlanMaterialRepository;
import com.htttdn.crm.repository.ProductionPlanRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductionPlanService {
    private static final int MAX_TARGET_QUANTITY = 1_000_000;
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999999.999");
    private final ProductRepository products;
    private final ProductRecipeRepository recipes;
    private final ProductionPlanRepository plans;
    private final ProductionPlanMaterialRepository planMaterials;
    private final EmployeeProfileRepository employees;
    private final MaterialIssueRequestRepository issueRequests;
    private final MaterialReturnRepository materialReturns;
    private final AuditTrail audit;

    public ProductionPlanService(ProductRepository products, ProductRecipeRepository recipes,
                                 ProductionPlanRepository plans, ProductionPlanMaterialRepository planMaterials,
                                 EmployeeProfileRepository employees, MaterialIssueRequestRepository issueRequests,
                                 MaterialReturnRepository materialReturns, AuditTrail audit) {
        this.products = products;
        this.recipes = recipes;
        this.plans = plans;
        this.planMaterials = planMaterials;
        this.employees = employees;
        this.issueRequests = issueRequests;
        this.materialReturns = materialReturns;
        this.audit = audit;
    }

    @Transactional
    public View create(CreateRequest request) {
        if (request == null || request.productId() == null || request.productId() < 1
                || request.targetQuantity() == null || request.targetQuantity() < 1
                || request.targetQuantity() > MAX_TARGET_QUANTITY || request.assignedEmployeeId() == null
                || request.assignedEmployeeId() < 1 || request.note() != null && request.note().length() > 2000) {
            throw invalid("Thông tin kế hoạch sản xuất không hợp lệ.");
        }
        Product product = products.findLockedById(request.productId()).filter(Product::isActive)
                .orElseThrow(() -> notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm đang kinh doanh."));
        ProductRecipe recipe = recipes.findFirstByProduct_IdAndActiveTrue(product.getId())
                .orElseThrow(() -> invalid("Sản phẩm chưa có công thức nguyên liệu đang hoạt động."));
        if (recipe.getItems().isEmpty()) throw invalid("Công thức sản phẩm chưa có nguyên liệu.");

        EmployeeProfile employee = employees.findByIdForUpdate(request.assignedEmployeeId())
                .orElseThrow(() -> invalid("Chỉ có thể giao kế hoạch cho nhân viên kho đang làm việc."));
        User account = employee.getAccount();
        if (account == null || !"EMPLOYEE".equals(account.getRole()) || account.isLocked()
                || account.getDeletedAt() != null || !"ACTIVE".equals(employee.getEmploymentStatus())
                || !"WAREHOUSE".equals(employee.getWorkArea())) {
            throw invalid("Chỉ có thể giao kế hoạch cho nhân viên kho đang làm việc.");
        }
        AuditTrail.Actor actor = AuditTrail.actor();
        if (actor == null || actor.id() == null) throw new IllegalStateException("Authenticated warehouse manager required");

        ProductionPlan plan = new ProductionPlan();
        plan.setPlanCode("PP-" + UUID.randomUUID().toString().replace("-", ""));
        plan.setProduct(product);
        plan.setRecipe(recipe);
        plan.setTargetQuantity(request.targetQuantity());
        plan.setCompletedQuantity(0);
        plan.setAssignedEmployee(employee);
        plan.setDueDate(request.dueDate());
        plan.setStatus("PLANNED");
        plan.setNote(normalizeNote(request.note()));
        plan.setCreatedBy(actor.id());
        plan.setCreatedAt(Instant.now());
        plan.setUpdatedAt(Instant.now());
        for (ProductRecipeItem recipeItem : recipe.getItems()) {
            RawMaterial material = recipeItem.getMaterial();
            BigDecimal perProduct = recipeItem.getQuantityPerProduct();
            BigDecimal required = perProduct.multiply(BigDecimal.valueOf(request.targetQuantity()))
                    .setScale(3, RoundingMode.UNNECESSARY);
            if (required.signum() <= 0 || required.compareTo(MAX_QUANTITY) > 0 || required.precision() > 15) {
                throw invalid("Định mức vượt giới hạn số lượng cho một kế hoạch.");
            }
            ProductionPlanMaterial snapshot = new ProductionPlanMaterial();
            snapshot.setMaterial(material);
            snapshot.setMaterialCode(recipeItem.getMaterialCode());
            snapshot.setMaterialName(recipeItem.getMaterialName());
            snapshot.setUnit(recipeItem.getUnit());
            snapshot.setQuantityPerProduct(perProduct);
            snapshot.setRequiredQuantity(required);
            plan.addMaterial(snapshot);
        }

        ProductionPlan saved = plans.saveAndFlush(plan);
        audit.record("CREATE", "PRODUCTION_PLAN", saved.getId(), Map.of(),
                Map.of("planCode", saved.getPlanCode(), "productId", product.getId(),
                        "recipeVersion", recipe.getVersion(), "targetQuantity", saved.getTargetQuantity(),
                        "assignedEmployeeId", employee.getEmployeeId()));
        return view(saved, saved.getMaterials());
    }

    @Transactional(readOnly = true)
    public PageView list(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw invalid("Tham số phân trang không hợp lệ.");
        var result = plans.findAllByOrderByCreatedAtDescIdDesc(
                PageRequest.of(page, size, Sort.unsorted()));
        List<Long> planIds = result.getContent().stream().map(ProductionPlan::getId).toList();
        Map<Long, List<ProductionPlanMaterial>> materialsByPlan = planIds.isEmpty() ? Map.of()
                : planMaterials.findByPlan_IdInOrderByPlan_IdAscIdAsc(planIds).stream()
                .collect(Collectors.groupingBy(item -> item.getPlan().getId()));
        List<View> content = result.getContent().stream()
                .map(plan -> view(plan, materialsByPlan.getOrDefault(plan.getId(), List.of()))).toList();
        return new PageView(content, result.getTotalElements(), result.getTotalPages(), page, size);
    }

    @Transactional(readOnly = true)
    public View detail(Long id) {
        ProductionPlan plan = plans.findById(id).orElseThrow(() ->
                notFound("PRODUCTION_PLAN_NOT_FOUND", "Không tìm thấy kế hoạch sản xuất."));
        return view(plan, planMaterials.findByPlan_IdOrderByIdAsc(id));
    }

    @Transactional
    public View cancel(Long id) {
        ProductionPlan plan = plans.findByIdForUpdate(id).orElseThrow(() ->
                notFound("PRODUCTION_PLAN_NOT_FOUND", "Không tìm thấy kế hoạch sản xuất."));
        if (!"PLANNED".equals(plan.getStatus()) && !"IN_PROGRESS".equals(plan.getStatus())) {
            throw invalid("Chỉ có thể hủy kế hoạch chưa hoàn tất.");
        }
        if (issueRequests.existsByPlan_IdAndStatus(id, "PENDING")
                || materialReturns.existsByPlan_IdAndStatus(id, "PENDING")) {
            throw invalid("Hãy xử lý các đề nghị nguyên liệu đang chờ trước khi hủy kế hoạch.");
        }
        boolean outstandingAllocation = planMaterials.findByPlan_IdOrderByIdAsc(id).stream()
                .anyMatch(material -> material.getAllocatedQuantity()
                        .subtract(material.getConsumedQuantity()).subtract(material.getReturnedQuantity()).signum() > 0);
        if (outstandingAllocation) throw invalid("Hãy hoàn trả nguyên liệu đã cấp trước khi hủy kế hoạch.");
        Map<String, Object> before = new java.util.HashMap<>();
        before.put("status", plan.getStatus());
        before.put("completedQuantity", plan.getCompletedQuantity());
        plan.setStatus("CANCELLED");
        plan.setClosedAt(Instant.now());
        plan.setUpdatedAt(Instant.now());
        ProductionPlan saved = plans.saveAndFlush(plan);
        audit.record("CANCEL", "PRODUCTION_PLAN", saved.getId(), before,
                Map.of("status", saved.getStatus(), "completedQuantity", saved.getCompletedQuantity()));
        return view(saved, planMaterials.findByPlan_IdOrderByIdAsc(id));
    }

    private static View view(ProductionPlan plan, List<ProductionPlanMaterial> planMaterialRows) {
        EmployeeProfile employee = plan.getAssignedEmployee();
        User account = employee.getAccount();
        List<MaterialView> materialViews = planMaterialRows.stream()
                .map(item -> new MaterialView(item.getId(), item.getMaterial().getId(), item.getMaterialCode(),
                        item.getMaterialName(), item.getUnit(), item.getQuantityPerProduct(), item.getRequiredQuantity(),
                        item.getAllocatedQuantity(), item.getConsumedQuantity(), item.getReturnedQuantity()))
                .toList();
        return new View(plan.getId(), plan.getPlanCode(), plan.getProduct().getId(), plan.getProduct().getName(),
                plan.getRecipe().getId(), plan.getRecipe().getVersion(), plan.getTargetQuantity(),
                plan.getCompletedQuantity(), employee.getEmployeeId(), account.getFullName(), account.getEmail(),
                plan.getDueDate(), plan.getStatus(), plan.getNote(), plan.getCreatedBy(), plan.getCreatedAt(),
                plan.getUpdatedAt(), plan.getClosedAt(), materialViews);
    }

    private static String normalizeNote(String note) {
        if (note == null) return null;
        String normalized = note.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PRODUCTION_PLAN", message);
    }

    private static ApiException notFound(String code, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message);
    }

    public record CreateRequest(@NotNull @Positive Long productId,
                                @NotNull @Positive @Max(MAX_TARGET_QUANTITY) Integer targetQuantity,
                                @NotNull @Positive Long assignedEmployeeId,
                                LocalDate dueDate, @Size(max = 2000) String note) {}
    public record MaterialView(Long id, Long materialId, String materialCode, String materialName, String unit,
                               BigDecimal quantityPerProduct, BigDecimal requiredQuantity,
                               BigDecimal allocatedQuantity, BigDecimal consumedQuantity, BigDecimal returnedQuantity) {}
    public record View(Long id, String planCode, Long productId, String productName, Long recipeId, int recipeVersion,
                       int targetQuantity, int completedQuantity, Long assignedEmployeeId, String assignedEmployeeName,
                       String assignedEmployeeEmail, LocalDate dueDate, String status, String note, Long createdBy,
                       Instant createdAt, Instant updatedAt, Instant closedAt, List<MaterialView> materials) {}
    public record PageView(List<View> content, long totalElements, int totalPages, int number, int size) {}
}
