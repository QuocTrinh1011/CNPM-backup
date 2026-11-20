package com.htttdn.crm.service.warehouse;

import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.InventoryItemType;
import com.htttdn.crm.entity.InventoryLocation;
import com.htttdn.crm.entity.InventoryMovementType;
import com.htttdn.crm.entity.MaterialReturn;
import com.htttdn.crm.entity.MaterialReturnItem;
import com.htttdn.crm.entity.ProductionPlan;
import com.htttdn.crm.entity.ProductionPlanMaterial;
import com.htttdn.crm.entity.RawMaterial;
import com.htttdn.crm.repository.MaterialReturnItemRepository;
import com.htttdn.crm.repository.MaterialReturnRepository;
import com.htttdn.crm.repository.ProductionPlanMaterialRepository;
import com.htttdn.crm.repository.ProductionPlanRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.htttdn.crm.service.*;
import com.htttdn.crm.service.WarehouseWorkService.*;
import static com.htttdn.crm.service.warehouse.WarehouseWorkValidator.*;

public final class MaterialReturnWorkflow {
    private final ProductionPlanRepository plans;
    private final ProductionPlanMaterialRepository planMaterials;
    private final MaterialReturnRepository returns;
    private final MaterialReturnItemRepository returnItems;
    private final InventoryMovementService movements;
    private final AuditTrail audit;
    private final WarehousePlanAccess access;
    private final WarehouseWorkViewMapper views;
    public MaterialReturnWorkflow(ProductionPlanRepository plans, ProductionPlanMaterialRepository planMaterials, MaterialReturnRepository returns, MaterialReturnItemRepository returnItems, InventoryMovementService movements, AuditTrail audit, WarehousePlanAccess access, WarehouseWorkViewMapper views) {
        this.plans = plans;
        this.planMaterials = planMaterials;
        this.returns = returns;
        this.returnItems = returnItems;
        this.movements = movements;
        this.audit = audit;
        this.access = access;
        this.views = views;
    }

    public ReturnPage myReturns(long employeeId, int page, int size) {
        return views.returnPage(returns.findAllByEmployee_EmployeeIdOrderByRequestedAtDescIdDesc(
                employeeId, pageRequest(page, size)));
    }

    public ReturnPage returnQueue(int page, int size) {
        return views.returnPage(returns.findAllByOrderByRequestedAtDescIdDesc(pageRequest(page, size)));
    }

    public ReturnView createReturn(EmployeeProfile employee, Long planId, ReturnRequestInput input) {
        if (input == null || input.items() == null || input.items().isEmpty() || input.items().size() > 100
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Chọn ít nhất một dòng nguyên liệu để hoàn trả.");
        }
        ProductionPlan plan = access.lockEmployeePlan(employee, planId);
        if ("CANCELLED".equals(plan.getStatus()) || "COMPLETED".equals(plan.getStatus())) {
            throw invalid("Kế hoạch đã đóng, không thể đề nghị hoàn trả.");
        }
        List<ProductionPlanMaterial> lockedLines = planMaterials.findAllByPlanIdForUpdate(plan.getId());
        Map<Long, ProductionPlanMaterial> lines = indexLines(lockedLines);
        List<LineInput> ordered = validateLines(input.items());
        List<ReturnDraft> drafts = new ArrayList<>();
        for (LineInput item : ordered) {
            ProductionPlanMaterial line = lines.get(item.planMaterialId());
            if (line == null) throw invalid("Nguyên liệu không thuộc kế hoạch được giao.");
            BigDecimal quantity = normalize(item.quantity());
            BigDecimal unreturned = line.getAllocatedQuantity().subtract(line.getConsumedQuantity())
                    .subtract(line.getReturnedQuantity()).subtract(planMaterials.sumPendingReturnQuantity(line.getId()));
            if (quantity.compareTo(unreturned) > 0) throw invalid("Số lượng hoàn vượt tồn nguyên liệu đã cấp.");
            drafts.add(new ReturnDraft(line, quantity));
        }
        MaterialReturn materialReturn = new MaterialReturn();
        materialReturn.setReturnCode("MR-" + UUID.randomUUID().toString().replace("-", ""));
        materialReturn.setPlan(plan);
        materialReturn.setEmployee(employee);
        materialReturn.setEmployeeNote(normalizeNote(input.note()));
        materialReturn.setRequestedAt(Instant.now());
        for (ReturnDraft draft : drafts) {
            MaterialReturnItem item = new MaterialReturnItem();
            item.setPlanMaterial(draft.line());
            item.setQuantity(draft.quantity());
            materialReturn.addItem(item);
        }
        MaterialReturn saved = returns.saveAndFlush(materialReturn);
        AuditTrail.Actor actor = requireActor();
        audit.recordAs(actor, "REQUEST", "MATERIAL_RETURN", saved.getId(), Map.of(),
                Map.of("returnCode", saved.getReturnCode(), "planId", plan.getId(), "itemCount", drafts.size()));
        return views.returnView(saved, returnItems.findByMaterialReturn_IdOrderByIdAsc(saved.getId()));
    }

    public ReturnView decideReturn(Long returnId, DecisionInput input) {
        Decision decision = validateDecision(input);
        MaterialReturn materialReturn = returns.findByIdForUpdate(returnId).orElseThrow(() ->
                notFound("MATERIAL_RETURN_NOT_FOUND", "Không tìm thấy đề nghị hoàn nguyên liệu."));
        if (!"PENDING".equals(materialReturn.getStatus())) throw invalid("Đề nghị hoàn đã được xử lý.");
        ProductionPlan plan = plans.findByIdForUpdate(materialReturn.getPlan().getId()).orElseThrow(() ->
                notFound("PRODUCTION_PLAN_NOT_FOUND", "Không tìm thấy kế hoạch sản xuất."));
        if (decision.approved() && ("CANCELLED".equals(plan.getStatus()) || "COMPLETED".equals(plan.getStatus()))) {
            throw invalid("Không thể hoàn nguyên liệu cho kế hoạch đã đóng.");
        }
        List<MaterialReturnItem> items = returnItems.findByMaterialReturn_IdOrderByIdAsc(returnId);
        List<ProductionPlanMaterial> lines = planMaterials.findAllByPlanIdForUpdate(plan.getId());
        Map<Long, ProductionPlanMaterial> linesById = indexLines(lines);
        AuditTrail.Actor actor = requireActor();
        materialReturn.setDecidedBy(actor.id());
        materialReturn.setDecidedAt(Instant.now());
        materialReturn.setDecisionNote(normalizeNote(decision.note()));
        if (decision.approved()) {
            List<ReturnTransfer> transfers = new ArrayList<>();
            for (MaterialReturnItem item : items) {
                ProductionPlanMaterial line = linesById.get(item.getPlanMaterial().getId());
                BigDecimal remaining = line == null ? BigDecimal.ZERO : line.getAllocatedQuantity()
                        .subtract(line.getConsumedQuantity()).subtract(line.getReturnedQuantity());
                BigDecimal pending = line == null ? BigDecimal.ZERO : planMaterials.sumPendingReturnQuantity(line.getId());
                if (line == null || item.getQuantity().compareTo(remaining) > 0 || pending.compareTo(remaining) > 0) {
                    throw invalid("Nguyên liệu đã được dùng hoặc hoàn trong đề nghị khác.");
                }
                transfers.add(new ReturnTransfer(line, item.getQuantity()));
            }
            List<RawMaterial> locked = access.lockMaterials(transfers.stream()
                    .map(transfer -> transfer.line().getMaterial().getId()).toList());
            Map<Long, RawMaterial> materialById = locked.stream().collect(Collectors.toMap(
                    RawMaterial::getId, Function.identity(), (left, right) -> left, LinkedHashMap::new));
            for (ReturnTransfer transfer : transfers) {
                if (!materialById.containsKey(transfer.line().getMaterial().getId())) {
                    throw invalid("Không tìm thấy nguyên liệu cần hoàn.");
                }
            }
            materialReturn.setStatus("APPROVED");
            MaterialReturn saved = returns.saveAndFlush(materialReturn);
            for (ReturnTransfer transfer : transfers) {
                ProductionPlanMaterial line = transfer.line();
                RawMaterial material = materialById.get(line.getMaterial().getId());
                BigDecimal availableAfter = material.getAvailableQuantity().add(transfer.quantity()).setScale(3);
                BigDecimal allocatedAfter = line.getAllocatedQuantity().subtract(line.getConsumedQuantity())
                        .subtract(line.getReturnedQuantity()).subtract(transfer.quantity()).setScale(3);
                material.setAvailableQuantity(availableAfter);
                material.setUpdatedAt(Instant.now());
                line.setReturnedQuantity(line.getReturnedQuantity().add(transfer.quantity()).setScale(3));
                movements.recordTransfer(InventoryItemType.MATERIAL, material.getId(),
                        InventoryLocation.PRODUCTION_ALLOCATED, plan.getId(), allocatedAfter,
                        InventoryLocation.RAW_MATERIAL_AVAILABLE, null, availableAfter,
                        transfer.quantity(), InventoryMovementType.MATERIAL_RETURN,
                        "MATERIAL_RETURN", saved.getId());
            }
            audit.recordAs(actor, "APPROVE", "MATERIAL_RETURN", saved.getId(),
                    Map.of("status", "PENDING"), Map.of("status", "APPROVED", "planId", plan.getId()));
        } else {
            materialReturn.setStatus("REJECTED");
            MaterialReturn saved = returns.saveAndFlush(materialReturn);
            audit.recordAs(actor, "REJECT", "MATERIAL_RETURN", saved.getId(),
                    Map.of("status", "PENDING"), Map.of("status", "REJECTED", "planId", plan.getId()));
        }
        return views.returnView(materialReturn, returnItems.findByMaterialReturn_IdOrderByIdAsc(returnId));
    }
    private record ReturnDraft(ProductionPlanMaterial line, BigDecimal quantity) {}

    private record ReturnTransfer(ProductionPlanMaterial line, BigDecimal quantity) {}

}
