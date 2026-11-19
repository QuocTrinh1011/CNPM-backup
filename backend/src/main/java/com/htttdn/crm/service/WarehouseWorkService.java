package com.htttdn.crm.service;

import com.htttdn.crm.service.warehouse.*;
import static com.htttdn.crm.service.warehouse.WarehouseWorkValidator.*;
import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.ProductionPlan;
import com.htttdn.crm.entity.ProductionPlanMaterial;
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
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WarehouseWorkService {

    private final MaterialIssueWorkflow materialIssueWorkflow;
    private final MaterialReturnWorkflow materialReturnWorkflow;
    private final ProductionRunWorkflow productionRunWorkflow;
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999999.999");
    private static final int MAX_PRODUCED_QUANTITY = 1_000_000;

    private final ProductionPlanRepository plans;
    private final ProductionPlanMaterialRepository planMaterials;

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
        this.planMaterials = planMaterials;
        WarehousePlanAccess access = new WarehousePlanAccess(plans, materials);
        WarehouseWorkViewMapper views = new WarehouseWorkViewMapper(issueItems, returnItems);
        this.materialIssueWorkflow = new MaterialIssueWorkflow(plans, planMaterials, issueRequests, issueItems, movements, audit, access, views);
        this.materialReturnWorkflow = new MaterialReturnWorkflow(plans, planMaterials, returns, returnItems, movements, audit, access, views);
        this.productionRunWorkflow = new ProductionRunWorkflow(plans, products, planMaterials, runs, finishedStock, movements, audit, access, views);
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
        return materialIssueWorkflow.myIssueRequests(employeeId, page, size);
    }

    @Transactional(readOnly = true)
    public RequestPage issueRequestQueue(int page, int size) {
        return materialIssueWorkflow.issueRequestQueue(page, size);
    }

    @Transactional
    public RequestView createIssueRequest(EmployeeProfile employee, IssueRequestInput input) {
        return materialIssueWorkflow.createIssueRequest(employee, input);
    }

    @Transactional
    public RequestView decideIssueRequest(Long requestId, DecisionInput input) {
        return materialIssueWorkflow.decideIssueRequest(requestId, input);
    }

    @Transactional
    public RunView produce(EmployeeProfile employee, Long planId, ProductionInput input) {
        return productionRunWorkflow.produce(employee, planId, input);
    }

    @Transactional(readOnly = true)
    public ReturnPage myReturns(long employeeId, int page, int size) {
        return materialReturnWorkflow.myReturns(employeeId, page, size);
    }

    @Transactional
    public ReturnPage returnQueue(int page, int size) {
        return materialReturnWorkflow.returnQueue(page, size);
    }

    @Transactional
    public ReturnView createReturn(EmployeeProfile employee, Long planId, ReturnRequestInput input) {
        return materialReturnWorkflow.createReturn(employee, planId, input);
    }

    @Transactional
    public ReturnView decideReturn(Long returnId, DecisionInput input) {
        return materialReturnWorkflow.decideReturn(returnId, input);
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
