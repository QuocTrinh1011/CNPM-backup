package com.htttdn.crm.service.warehouse;

import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.InventoryItemType;
import com.htttdn.crm.entity.InventoryLocation;
import com.htttdn.crm.entity.InventoryMovementType;
import com.htttdn.crm.entity.MaterialIssueRequest;
import com.htttdn.crm.entity.MaterialIssueRequestItem;
import com.htttdn.crm.entity.MaterialReturn;
import com.htttdn.crm.entity.MaterialReturnItem;
import com.htttdn.crm.entity.ProductionPlan;
import com.htttdn.crm.entity.ProductionPlanMaterial;
import com.htttdn.crm.entity.ProductionRun;
import com.htttdn.crm.entity.ProductionRunConsumption;
import com.htttdn.crm.entity.RawMaterial;
import com.htttdn.crm.entity.WarehouseFinishedStock;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.MaterialIssueRequestItemRepository;
import com.htttdn.crm.repository.MaterialIssueRequestRepository;
import com.htttdn.crm.repository.MaterialReturnItemRepository;
import com.htttdn.crm.repository.MaterialReturnRepository;
import com.htttdn.crm.repository.ProductionPlanMaterialRepository;
import com.htttdn.crm.repository.ProductionPlanRepository;
import com.htttdn.crm.repository.ProductionRunRepository;
import com.htttdn.crm.repository.ProductRepository;
import com.htttdn.crm.repository.RawMaterialRepository;
import com.htttdn.crm.repository.WarehouseFinishedStockRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.htttdn.crm.service.*;
import com.htttdn.crm.service.WarehouseWorkService.*;
import static com.htttdn.crm.service.warehouse.WarehouseWorkValidator.*;

public final class MaterialIssueWorkflow {
    private final ProductionPlanRepository plans;
    private final ProductionPlanMaterialRepository planMaterials;
    private final MaterialIssueRequestRepository issueRequests;
    private final MaterialIssueRequestItemRepository issueItems;
    private final InventoryMovementService movements;
    private final AuditTrail audit;
    private final WarehousePlanAccess access;
    private final WarehouseWorkViewMapper views;
    public MaterialIssueWorkflow(ProductionPlanRepository plans, ProductionPlanMaterialRepository planMaterials, MaterialIssueRequestRepository issueRequests, MaterialIssueRequestItemRepository issueItems, InventoryMovementService movements, AuditTrail audit, WarehousePlanAccess access, WarehouseWorkViewMapper views) {
        this.plans = plans;
        this.planMaterials = planMaterials;
        this.issueRequests = issueRequests;
        this.issueItems = issueItems;
        this.movements = movements;
        this.audit = audit;
        this.access = access;
        this.views = views;
    }

    public RequestPage myIssueRequests(long employeeId, int page, int size) {
        return views.requestPage(issueRequests.findAllByEmployee_EmployeeIdOrderByRequestedAtDescIdDesc(
                employeeId, pageRequest(page, size)));
    }

    public RequestPage issueRequestQueue(int page, int size) {
        return views.requestPage(issueRequests.findAllByOrderByRequestedAtDescIdDesc(pageRequest(page, size)));
    }

    public RequestView createIssueRequest(EmployeeProfile employee, IssueRequestInput input) {
        if (input == null || input.planId() == null || input.planId() < 1 || input.items() == null
                || input.items().isEmpty() || input.items().size() > 100
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Chọn kế hoạch và ít nhất một dòng nguyên liệu cần cấp.");
        }
        ProductionPlan plan = access.lockEmployeePlan(employee, input.planId());
        List<ProductionPlanMaterial> lockedLines = planMaterials.findAllByPlanIdForUpdate(plan.getId());
        Map<Long, ProductionPlanMaterial> lines = indexLines(lockedLines);
        List<LineInput> ordered = validateLines(input.items());
        List<IssueDraft> drafts = new ArrayList<>();
        for (LineInput item : ordered) {
            ProductionPlanMaterial line = lines.get(item.planMaterialId());
            if (line == null) throw invalid("Nguyên liệu không thuộc kế hoạch được giao.");
            BigDecimal quantity = normalize(item.quantity());
            BigDecimal pending = planMaterials.sumPendingIssueQuantity(line.getId());
            BigDecimal availableNeed = line.getRequiredQuantity().add(line.getReturnedQuantity())
                    .subtract(line.getAllocatedQuantity()).subtract(pending);
            if (quantity.compareTo(availableNeed) > 0) {
                throw invalid("Số lượng yêu cầu vượt định mức còn lại của kế hoạch.");
            }
            drafts.add(new IssueDraft(line, quantity));
        }

        AuditTrail.Actor actor = requireActor();
        MaterialIssueRequest request = new MaterialIssueRequest();
        request.setRequestCode("MI-" + UUID.randomUUID().toString().replace("-", ""));
        request.setPlan(plan);
        request.setEmployee(employee);
        request.setEmployeeNote(normalizeNote(input.note()));
        request.setRequestedAt(Instant.now());
        for (IssueDraft draft : drafts) {
            MaterialIssueRequestItem item = new MaterialIssueRequestItem();
            item.setPlanMaterial(draft.line());
            item.setQuantity(draft.quantity());
            request.addItem(item);
        }
        MaterialIssueRequest saved = issueRequests.saveAndFlush(request);
        audit.recordAs(actor, "REQUEST", "MATERIAL_ISSUE_REQUEST", saved.getId(), Map.of(),
                Map.of("requestCode", saved.getRequestCode(), "planId", plan.getId(), "itemCount", drafts.size()));
        return views.requestView(saved, issueItems.findByRequest_IdOrderByIdAsc(saved.getId()));
    }

    public RequestView decideIssueRequest(Long requestId, DecisionInput input) {
        Decision decision = validateDecision(input);
        MaterialIssueRequest request = issueRequests.findByIdForUpdate(requestId).orElseThrow(() ->
                notFound("MATERIAL_ISSUE_REQUEST_NOT_FOUND", "Không tìm thấy đề nghị cấp nguyên liệu."));
        if (!"PENDING".equals(request.getStatus())) throw invalid("Đề nghị đã được xử lý.");
        ProductionPlan plan = plans.findByIdForUpdate(request.getPlan().getId()).orElseThrow(() ->
                notFound("PRODUCTION_PLAN_NOT_FOUND", "Không tìm thấy kế hoạch sản xuất."));
        if (decision.approved() && ("CANCELLED".equals(plan.getStatus()) || "COMPLETED".equals(plan.getStatus()))) {
            throw invalid("Không thể cấp nguyên liệu cho kế hoạch đã đóng.");
        }
        List<MaterialIssueRequestItem> items = issueItems.findByRequest_IdOrderByIdAsc(requestId);
        List<ProductionPlanMaterial> lines = planMaterials.findAllByPlanIdForUpdate(plan.getId());
        Map<Long, ProductionPlanMaterial> linesById = indexLines(lines);
        AuditTrail.Actor actor = requireActor();
        request.setDecidedBy(actor.id());
        request.setDecidedAt(Instant.now());
        request.setDecisionNote(normalizeNote(decision.note()));
        if (decision.approved()) {
            List<IssueTransfer> transfers = new ArrayList<>();
            for (MaterialIssueRequestItem item : items) {
                ProductionPlanMaterial line = linesById.get(item.getPlanMaterial().getId());
                if (line == null) throw invalid("Đề nghị chứa nguyên liệu không thuộc kế hoạch.");
                BigDecimal pending = planMaterials.sumPendingIssueQuantity(line.getId());
                if (line.getAllocatedQuantity().add(pending)
                        .compareTo(line.getRequiredQuantity().add(line.getReturnedQuantity())) > 0) {
                    throw invalid("Tổng đề nghị cấp vượt định mức nguyên liệu.");
                }
                transfers.add(new IssueTransfer(line, item.getQuantity()));
            }
            List<RawMaterial> locked = access.lockMaterials(transfers.stream()
                    .map(transfer -> transfer.line().getMaterial().getId()).toList());
            Map<Long, RawMaterial> materialById = locked.stream().collect(Collectors.toMap(
                    RawMaterial::getId, Function.identity(), (left, right) -> left, LinkedHashMap::new));
            for (IssueTransfer transfer : transfers) {
                RawMaterial material = materialById.get(transfer.line().getMaterial().getId());
                if (material == null || !material.isActive()
                        || material.getAvailableQuantity().compareTo(transfer.quantity()) < 0) {
                    throw invalid("Tồn nguyên liệu khả dụng không đủ để duyệt toàn bộ đề nghị.");
                }
            }
            request.setStatus("APPROVED");
            MaterialIssueRequest saved = issueRequests.saveAndFlush(request);
            for (IssueTransfer transfer : transfers) {
                ProductionPlanMaterial line = transfer.line();
                RawMaterial material = materialById.get(line.getMaterial().getId());
                BigDecimal availableAfter = material.getAvailableQuantity().subtract(transfer.quantity()).setScale(3);
                BigDecimal allocatedAfter = line.getAllocatedQuantity().subtract(line.getConsumedQuantity())
                        .subtract(line.getReturnedQuantity()).add(transfer.quantity()).setScale(3);
                material.setAvailableQuantity(availableAfter);
                material.setUpdatedAt(Instant.now());
                line.setAllocatedQuantity(line.getAllocatedQuantity().add(transfer.quantity()).setScale(3));
                movements.recordTransfer(InventoryItemType.MATERIAL, material.getId(),
                        InventoryLocation.RAW_MATERIAL_AVAILABLE, null, availableAfter,
                        InventoryLocation.PRODUCTION_ALLOCATED, plan.getId(), allocatedAfter,
                        transfer.quantity(), InventoryMovementType.MATERIAL_ISSUE,
                        "MATERIAL_ISSUE_REQUEST", saved.getId());
            }
            audit.recordAs(actor, "APPROVE", "MATERIAL_ISSUE_REQUEST", saved.getId(),
                    Map.of("status", "PENDING"), Map.of("status", "APPROVED", "planId", plan.getId()));
        } else {
            request.setStatus("REJECTED");
            MaterialIssueRequest saved = issueRequests.saveAndFlush(request);
            audit.recordAs(actor, "REJECT", "MATERIAL_ISSUE_REQUEST", saved.getId(),
                    Map.of("status", "PENDING"), Map.of("status", "REJECTED", "planId", plan.getId()));
        }
        return views.requestView(request, issueItems.findByRequest_IdOrderByIdAsc(requestId));
    }
    private record IssueDraft(ProductionPlanMaterial line, BigDecimal quantity) {}

    private record IssueTransfer(ProductionPlanMaterial line, BigDecimal quantity) {}

}
