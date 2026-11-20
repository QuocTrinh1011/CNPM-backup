package com.cnpm.clothingstore.service.warehouse;

import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.InventoryItemType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.entity.ProductionPlan;
import com.cnpm.clothingstore.entity.ProductionPlanMaterial;
import com.cnpm.clothingstore.entity.ProductionRun;
import com.cnpm.clothingstore.entity.ProductionRunConsumption;
import com.cnpm.clothingstore.entity.WarehouseFinishedStock;
import com.cnpm.clothingstore.repository.ProductionPlanMaterialRepository;
import com.cnpm.clothingstore.repository.ProductionPlanRepository;
import com.cnpm.clothingstore.repository.ProductionRunRepository;
import com.cnpm.clothingstore.repository.ProductRepository;
import com.cnpm.clothingstore.repository.WarehouseFinishedStockRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.cnpm.clothingstore.service.*;
import com.cnpm.clothingstore.service.WarehouseWorkService.*;
import static com.cnpm.clothingstore.service.warehouse.WarehouseWorkValidator.*;

public final class ProductionRunWorkflow {
    private static final int MAX_PRODUCED_QUANTITY = 1_000_000;
    private final ProductionPlanRepository plans;
    private final ProductRepository products;
    private final ProductionPlanMaterialRepository planMaterials;
    private final ProductionRunRepository runs;
    private final WarehouseFinishedStockRepository finishedStock;
    private final InventoryMovementService movements;
    private final AuditTrail audit;
    private final WarehousePlanAccess access;
    private final WarehouseWorkViewMapper views;
    public ProductionRunWorkflow(ProductionPlanRepository plans, ProductRepository products, ProductionPlanMaterialRepository planMaterials, ProductionRunRepository runs, WarehouseFinishedStockRepository finishedStock, InventoryMovementService movements, AuditTrail audit, WarehousePlanAccess access, WarehouseWorkViewMapper views) {
        this.plans = plans;
        this.products = products;
        this.planMaterials = planMaterials;
        this.runs = runs;
        this.finishedStock = finishedStock;
        this.movements = movements;
        this.audit = audit;
        this.access = access;
        this.views = views;
    }

    public RunView produce(EmployeeProfile employee, Long planId, ProductionInput input) {
        if (input == null || input.producedQuantity() == null || input.producedQuantity() < 1
                || input.producedQuantity() > MAX_PRODUCED_QUANTITY
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Số lượng thành phẩm không hợp lệ.");
        }
        ProductionPlan plan = access.lockEmployeePlan(employee, planId);
        if (!"PLANNED".equals(plan.getStatus()) && !"IN_PROGRESS".equals(plan.getStatus())) {
            throw invalid("Kế hoạch không còn nhận sản lượng.");
        }
        if (input.producedQuantity() > plan.getTargetQuantity() - plan.getCompletedQuantity()) {
            throw invalid("Sản lượng vượt số lượng còn lại của kế hoạch.");
        }
        List<ProductionPlanMaterial> lines = planMaterials.findAllByPlanIdForUpdate(plan.getId());
        if (lines.isEmpty()) throw invalid("Kế hoạch chưa có định mức nguyên liệu.");
        List<Consumption> consumptions = new ArrayList<>();
        for (ProductionPlanMaterial line : lines) {
            BigDecimal quantity = line.getQuantityPerProduct().multiply(BigDecimal.valueOf(input.producedQuantity()))
                    .setScale(3, RoundingMode.UNNECESSARY);
            BigDecimal unconsumed = line.getAllocatedQuantity().subtract(line.getConsumedQuantity())
                    .subtract(line.getReturnedQuantity());
            if (unconsumed.compareTo(quantity) < 0) {
                throw invalid("Nguyên liệu đã cấp không đủ để ghi nhận sản lượng này.");
            }
            consumptions.add(new Consumption(line, quantity));
        }
        int completedAfter = plan.getCompletedQuantity() + input.producedQuantity();
        boolean completesPlan = completedAfter == plan.getTargetQuantity();
        if (completesPlan && consumptions.stream().anyMatch(consumption ->
                consumption.line().getAllocatedQuantity().subtract(consumption.line().getConsumedQuantity())
                        .subtract(consumption.line().getReturnedQuantity()).compareTo(consumption.quantity()) != 0)) {
            throw invalid("Hãy hoàn trả nguyên liệu dư trước khi hoàn tất kế hoạch.");
        }

        var product = products.findLockedById(plan.getProduct().getId()).orElseThrow(() ->
                notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm của kế hoạch."));
        // Serialize finished-warehouse balance creation and updates for plans of the same product.
        ProductionRun run = new ProductionRun();
        run.setRunCode("RUN-" + UUID.randomUUID().toString().replace("-", ""));
        run.setPlan(plan);
        run.setEmployee(employee);
        run.setProducedQuantity(input.producedQuantity());
        run.setNote(normalizeNote(input.note()));
        run.setCreatedAt(Instant.now());
        for (Consumption consumption : consumptions) {
            ProductionRunConsumption item = new ProductionRunConsumption();
            item.setPlanMaterial(consumption.line());
            item.setMaterialCode(consumption.line().getMaterialCode());
            item.setMaterialName(consumption.line().getMaterialName());
            item.setUnit(consumption.line().getUnit());
            item.setQuantity(consumption.quantity());
            run.addConsumption(item);
        }
        ProductionRun saved = runs.saveAndFlush(run);

        WarehouseFinishedStock stock = finishedStock.findByProductIdForUpdate(product.getId())
                .orElseGet(() -> {
                    WarehouseFinishedStock created = new WarehouseFinishedStock();
                    created.setProduct(product);
                    return created;
                });
        if (stock.getQuantity() > Integer.MAX_VALUE - input.producedQuantity()) {
            throw invalid("Tồn thành phẩm trong kho vượt giới hạn.");
        }
        int finishedAfter = stock.getQuantity() + input.producedQuantity();
        stock.setQuantity(finishedAfter);
        stock.setUpdatedAt(Instant.now());
        finishedStock.save(stock);

        for (Consumption consumption : consumptions) {
            ProductionPlanMaterial line = consumption.line();
            BigDecimal allocatedAfter = line.getAllocatedQuantity().subtract(line.getConsumedQuantity())
                    .subtract(line.getReturnedQuantity()).subtract(consumption.quantity()).setScale(3);
            line.setConsumedQuantity(line.getConsumedQuantity().add(consumption.quantity()).setScale(3));
            movements.recordChange(InventoryItemType.MATERIAL, line.getMaterial().getId(),
                    InventoryLocation.PRODUCTION_ALLOCATED, plan.getId(), consumption.quantity().negate(),
                    allocatedAfter, InventoryMovementType.PRODUCTION_CONSUMPTION,
                    "PRODUCTION_RUN", saved.getId());
        }
        movements.recordChange(InventoryItemType.PRODUCT, product.getId(), InventoryLocation.FINISHED_WAREHOUSE,
                null, BigDecimal.valueOf(input.producedQuantity()), BigDecimal.valueOf(finishedAfter),
                InventoryMovementType.PRODUCTION_OUTPUT, "PRODUCTION_RUN", saved.getId());
        plan.setCompletedQuantity(completedAfter);
        plan.setStatus(completesPlan ? "COMPLETED" : "IN_PROGRESS");
        plan.setUpdatedAt(Instant.now());
        if (completesPlan) plan.setClosedAt(Instant.now());
        plans.save(plan);
        AuditTrail.Actor actor = requireActor();
        audit.recordAs(actor, "POST", "PRODUCTION_RUN", saved.getId(), Map.of(),
                Map.of("planId", plan.getId(), "producedQuantity", saved.getProducedQuantity(),
                        "finishedWarehouseQuantity", finishedAfter));
        return views.runView(saved);
    }
    private record Consumption(ProductionPlanMaterial line, BigDecimal quantity) {}

}
