package com.htttdn.crm.service;

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

@Service
public class WarehouseWorkService {
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999999.999");
    private static final int MAX_PRODUCED_QUANTITY = 1_000_000;

    private final ProductionPlanRepository plans;
    private final ProductRepository products;
    private final ProductionPlanMaterialRepository planMaterials;
    private final RawMaterialRepository materials;
    private final MaterialIssueRequestRepository issueRequests;
    private final MaterialIssueRequestItemRepository issueItems;
    private final MaterialReturnRepository returns;
    private final MaterialReturnItemRepository returnItems;
    private final ProductionRunRepository runs;
    private final WarehouseFinishedStockRepository finishedStock;
    private final InventoryMovementService movements;
    private final AuditTrail audit;

    public WarehouseWorkService(ProductionPlanRepository plans,
                                ProductRepository products,
                                ProductionPlanMaterialRepository planMaterials,
                                RawMaterialRepository materials,
                                MaterialIssueRequestRepository issueRequests,
                                MaterialIssueRequestItemRepository issueItems,
                                MaterialReturnRepository returns,
                                MaterialReturnItemRepository returnItems,
                                ProductionRunRepository runs,
                                WarehouseFinishedStockRepository finishedStock,
                                InventoryMovementService movements,
                                AuditTrail audit) {
        this.plans = plans;
        this.products = products;
        this.planMaterials = planMaterials;
        this.materials = materials;
        this.issueRequests = issueRequests;
        this.issueItems = issueItems;
        this.returns = returns;
        this.returnItems = returnItems;
        this.runs = runs;
        this.finishedStock = finishedStock;
        this.movements = movements;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public PlanPage myPlans(long employeeId, int page, int size) {
        Page<ProductionPlan> result = plans.findAllByAssignedEmployee_EmployeeIdOrderByCreatedAtDescIdDesc(
                employeeId, pageRequest(page, size));
        List<Long> ids = result.getContent().stream().map(ProductionPlan::getId).toList();
        Map<Long, List<ProductionPlanMaterial>> byPlan = ids.isEmpty() ? Map.of()
                : planMaterials.findByPlan_IdInOrderByPlan_IdAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(item -> item.getPlan().getId()));
        return new PlanPage(result.getContent().stream()
                .map(plan -> ProductionPlanServiceView.of(plan, byPlan.getOrDefault(plan.getId(), List.of()))).toList(),
                result.getTotalElements(), result.getTotalPages(), page, size);
    }

    @Transactional(readOnly = true)
    public RequestPage myIssueRequests(long employeeId, int page, int size) {
        return requestPage(issueRequests.findAllByEmployee_EmployeeIdOrderByRequestedAtDescIdDesc(
                employeeId, pageRequest(page, size)));
    }

    @Transactional(readOnly = true)
    public RequestPage issueRequestQueue(int page, int size) {
        return requestPage(issueRequests.findAllByOrderByRequestedAtDescIdDesc(pageRequest(page, size)));
    }

    @Transactional
    public RequestView createIssueRequest(EmployeeProfile employee, IssueRequestInput input) {
        if (input == null || input.planId() == null || input.planId() < 1 || input.items() == null
                || input.items().isEmpty() || input.items().size() > 100
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Chọn kế hoạch và ít nhất một dòng nguyên liệu cần cấp.");
        }
        ProductionPlan plan = lockEmployeePlan(employee, input.planId());
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
        return requestView(saved, issueItems.findByRequest_IdOrderByIdAsc(saved.getId()));
    }

    @Transactional
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
            List<RawMaterial> locked = lockMaterials(transfers.stream()
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
        return requestView(request, issueItems.findByRequest_IdOrderByIdAsc(requestId));
    }

    @Transactional
    public RunView produce(EmployeeProfile employee, Long planId, ProductionInput input) {
        if (input == null || input.producedQuantity() == null || input.producedQuantity() < 1
                || input.producedQuantity() > MAX_PRODUCED_QUANTITY
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Số lượng thành phẩm không hợp lệ.");
        }
        ProductionPlan plan = lockEmployeePlan(employee, planId);
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
        return runView(saved);
    }

    @Transactional(readOnly = true)
    public ReturnPage myReturns(long employeeId, int page, int size) {
        return returnPage(returns.findAllByEmployee_EmployeeIdOrderByRequestedAtDescIdDesc(
                employeeId, pageRequest(page, size)));
    }

    @Transactional
    public ReturnPage returnQueue(int page, int size) {
        return returnPage(returns.findAllByOrderByRequestedAtDescIdDesc(pageRequest(page, size)));
    }

    @Transactional
    public ReturnView createReturn(EmployeeProfile employee, Long planId, ReturnRequestInput input) {
        if (input == null || input.items() == null || input.items().isEmpty() || input.items().size() > 100
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Chọn ít nhất một dòng nguyên liệu để hoàn trả.");
        }
        ProductionPlan plan = lockEmployeePlan(employee, planId);
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
        return returnView(saved, returnItems.findByMaterialReturn_IdOrderByIdAsc(saved.getId()));
    }

    @Transactional
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
            List<RawMaterial> locked = lockMaterials(transfers.stream()
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
        return returnView(materialReturn, returnItems.findByMaterialReturn_IdOrderByIdAsc(returnId));
    }

    private RequestPage requestPage(Page<MaterialIssueRequest> result) {
        List<Long> ids = result.getContent().stream().map(MaterialIssueRequest::getId).toList();
        Map<Long, List<MaterialIssueRequestItem>> grouped = ids.isEmpty() ? Map.of()
                : issueItems.findByRequest_IdInOrderByRequest_IdAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(item -> item.getRequest().getId()));
        return new RequestPage(result.getContent().stream()
                .map(row -> requestView(row, grouped.getOrDefault(row.getId(), List.of()))).toList(),
                result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize());
    }

    private ReturnPage returnPage(Page<MaterialReturn> result) {
        List<Long> ids = result.getContent().stream().map(MaterialReturn::getId).toList();
        Map<Long, List<MaterialReturnItem>> grouped = ids.isEmpty() ? Map.of()
                : returnItems.findByMaterialReturn_IdInOrderByMaterialReturn_IdAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(item -> item.getMaterialReturn().getId()));
        return new ReturnPage(result.getContent().stream()
                .map(row -> returnView(row, grouped.getOrDefault(row.getId(), List.of()))).toList(),
                result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize());
    }

    private RequestView requestView(MaterialIssueRequest request, List<MaterialIssueRequestItem> items) {
        return new RequestView(request.getId(), request.getRequestCode(), request.getPlan().getId(),
                request.getPlan().getPlanCode(), request.getEmployee().getEmployeeId(),
                request.getEmployee().getAccount().getFullName(), request.getStatus(), request.getEmployeeNote(),
                request.getRequestedAt(), request.getDecidedBy(), request.getDecidedAt(), request.getDecisionNote(),
                items.stream().map(item -> materialView(item.getPlanMaterial(), item.getQuantity())).toList());
    }

    private ReturnView returnView(MaterialReturn materialReturn, List<MaterialReturnItem> items) {
        return new ReturnView(materialReturn.getId(), materialReturn.getReturnCode(), materialReturn.getPlan().getId(),
                materialReturn.getPlan().getPlanCode(), materialReturn.getEmployee().getEmployeeId(),
                materialReturn.getEmployee().getAccount().getFullName(), materialReturn.getStatus(),
                materialReturn.getEmployeeNote(), materialReturn.getRequestedAt(), materialReturn.getDecidedBy(),
                materialReturn.getDecidedAt(), materialReturn.getDecisionNote(),
                items.stream().map(item -> materialView(item.getPlanMaterial(), item.getQuantity())).toList());
    }

    private static MaterialView materialView(ProductionPlanMaterial line, BigDecimal quantity) {
        return new MaterialView(line.getId(), line.getMaterial().getId(), line.getMaterialCode(),
                line.getMaterialName(), line.getUnit(), quantity);
    }

    private RunView runView(ProductionRun run) {
        return new RunView(run.getId(), run.getRunCode(), run.getPlan().getId(), run.getEmployee().getEmployeeId(),
                run.getEmployee().getAccount().getFullName(), run.getProducedQuantity(), run.getNote(), run.getCreatedAt(),
                run.getConsumptions().stream().map(item -> new ConsumptionView(item.getPlanMaterial().getId(),
                        item.getMaterialCode(), item.getMaterialName(), item.getUnit(), item.getQuantity())).toList());
    }

    private ProductionPlan lockEmployeePlan(EmployeeProfile employee, Long planId) {
        if (planId == null || planId < 1) throw invalid("Kế hoạch không hợp lệ.");
        ProductionPlan plan = plans.findByIdForUpdate(planId).orElseThrow(() ->
                notFound("PRODUCTION_PLAN_NOT_FOUND", "Không tìm thấy kế hoạch sản xuất."));
        if (!plan.getAssignedEmployee().getEmployeeId().equals(employee.getEmployeeId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PRODUCTION_PLAN_NOT_ASSIGNED", "Kế hoạch không được giao cho tài khoản này.");
        }
        if ("CANCELLED".equals(plan.getStatus()) || "COMPLETED".equals(plan.getStatus())) {
            throw invalid("Kế hoạch đã đóng.");
        }
        return plan;
    }

    private List<RawMaterial> lockMaterials(List<Long> ids) {
        List<Long> orderedIds = ids.stream().distinct().sorted().toList();
        if (orderedIds.isEmpty()) return List.of();
        return materials.findAllByIdInForUpdate(orderedIds);
    }

    private static Map<Long, ProductionPlanMaterial> indexLines(List<ProductionPlanMaterial> lines) {
        return lines.stream().collect(Collectors.toMap(ProductionPlanMaterial::getId, Function.identity()));
    }

    private static List<LineInput> validateLines(List<LineInput> lines) {
        Set<Long> ids = new HashSet<>();
        for (LineInput line : lines) {
            if (line == null || line.planMaterialId() == null || line.planMaterialId() < 1
                    || line.quantity() == null || line.quantity().signum() <= 0
                    || line.quantity().scale() > 3 || line.quantity().precision() > 15
                    || line.quantity().compareTo(MAX_QUANTITY) > 0 || !ids.add(line.planMaterialId())) {
                throw invalid("Mỗi nguyên liệu chỉ được khai báo một lần; số lượng phải dương, tối đa 3 số thập phân.");
            }
        }
        return lines.stream().sorted(Comparator.comparing(LineInput::planMaterialId)).toList();
    }

    private static BigDecimal normalize(BigDecimal amount) {
        return amount.setScale(3, RoundingMode.UNNECESSARY);
    }

    private static Decision validateDecision(DecisionInput input) {
        if (input == null || input.decision() == null
                || !("APPROVE".equals(input.decision()) || "REJECT".equals(input.decision()))
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Quyết định phải là APPROVE hoặc REJECT; ghi chú tối đa 2000 ký tự.");
        }
        return new Decision("APPROVE".equals(input.decision()), input.note());
    }

    private AuditTrail.Actor requireActor() {
        AuditTrail.Actor actor = AuditTrail.actor();
        if (actor == null || actor.id() == null) throw new IllegalStateException("Authenticated warehouse actor required");
        return actor;
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw invalid("Tham số phân trang không hợp lệ.");
        return PageRequest.of(page, size, Sort.unsorted());
    }

    private static String normalizeNote(String note) {
        if (note == null) return null;
        String normalized = note.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WAREHOUSE_WORK", message);
    }

    private static ApiException notFound(String code, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message);
    }

    public record LineInput(@NotNull @Positive Long planMaterialId,
                            @NotNull @DecimalMin(value = "0.000", inclusive = false)
                            @Digits(integer = 12, fraction = 3) BigDecimal quantity) {}
    public record IssueRequestInput(@NotNull @Positive Long planId, @NotEmpty @Size(max = 100)
                                    List<@NotNull @Valid LineInput> items, @Size(max = 2000) String note) {}
    public record ReturnRequestInput(@NotEmpty @Size(max = 100) List<@NotNull @Valid LineInput> items,
                                     @Size(max = 2000) String note) {}
    public record ProductionInput(@NotNull @Positive @Max(MAX_PRODUCED_QUANTITY) Integer producedQuantity,
                                  @Size(max = 2000) String note) {}
    public record DecisionInput(@NotNull String decision, @Size(max = 2000) String note) {}
    public record MaterialView(Long planMaterialId, Long materialId, String materialCode, String materialName,
                               String unit, BigDecimal quantity) {}
    public record RequestView(Long id, String requestCode, Long planId, String planCode, Long employeeId,
                              String employeeName, String status, String employeeNote, Instant requestedAt,
                              Long decidedBy, Instant decidedAt, String decisionNote, List<MaterialView> items) {}
    public record RequestPage(List<RequestView> content, long totalElements, int totalPages, int number, int size) {}
    public record ReturnView(Long id, String returnCode, Long planId, String planCode, Long employeeId,
                             String employeeName, String status, String employeeNote, Instant requestedAt,
                             Long decidedBy, Instant decidedAt, String decisionNote, List<MaterialView> items) {}
    public record ReturnPage(List<ReturnView> content, long totalElements, int totalPages, int number, int size) {}
    public record ConsumptionView(Long planMaterialId, String materialCode, String materialName, String unit,
                                  BigDecimal quantity) {}
    public record RunView(Long id, String runCode, Long planId, Long employeeId, String employeeName,
                          int producedQuantity, String note, Instant createdAt, List<ConsumptionView> consumptions) {}
    public record PlanPage(List<ProductionPlanService.View> content, long totalElements, int totalPages,
                           int number, int size) {}

    private record Decision(boolean approved, String note) {}
    private record IssueDraft(ProductionPlanMaterial line, BigDecimal quantity) {}
    private record IssueTransfer(ProductionPlanMaterial line, BigDecimal quantity) {}
    private record ReturnDraft(ProductionPlanMaterial line, BigDecimal quantity) {}
    private record ReturnTransfer(ProductionPlanMaterial line, BigDecimal quantity) {}
    private record Consumption(ProductionPlanMaterial line, BigDecimal quantity) {}

    private static class ProductionPlanServiceView {
        static ProductionPlanService.View of(ProductionPlan plan, List<ProductionPlanMaterial> lines) {
            return new ProductionPlanService.View(plan.getId(), plan.getPlanCode(), plan.getProduct().getId(),
                    plan.getProduct().getName(), plan.getRecipe().getId(), plan.getRecipe().getVersion(),
                    plan.getTargetQuantity(), plan.getCompletedQuantity(), plan.getAssignedEmployee().getEmployeeId(),
                    plan.getAssignedEmployee().getAccount().getFullName(), plan.getAssignedEmployee().getAccount().getEmail(),
                    plan.getDueDate(), plan.getStatus(), plan.getNote(), plan.getCreatedBy(), plan.getCreatedAt(),
                    plan.getUpdatedAt(), plan.getClosedAt(), lines.stream().map(item -> new ProductionPlanService.MaterialView(
                            item.getId(), item.getMaterial().getId(), item.getMaterialCode(), item.getMaterialName(),
                            item.getUnit(), item.getQuantityPerProduct(), item.getRequiredQuantity(),
                            item.getAllocatedQuantity(), item.getConsumedQuantity(), item.getReturnedQuantity())).toList());
        }
    }
}
