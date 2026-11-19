package com.htttdn.crm.service.warehouse;

import com.htttdn.crm.entity.MaterialIssueRequest;
import com.htttdn.crm.entity.MaterialIssueRequestItem;
import com.htttdn.crm.entity.MaterialReturn;
import com.htttdn.crm.entity.MaterialReturnItem;
import com.htttdn.crm.entity.ProductionPlanMaterial;
import com.htttdn.crm.entity.ProductionRun;
import com.htttdn.crm.repository.MaterialIssueRequestItemRepository;
import com.htttdn.crm.repository.MaterialReturnItemRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import com.htttdn.crm.service.*;
import com.htttdn.crm.service.WarehouseWorkService.*;
import static com.htttdn.crm.service.warehouse.WarehouseWorkValidator.*;

public final class WarehouseWorkViewMapper {
    private final MaterialIssueRequestItemRepository issueItems;
    private final MaterialReturnItemRepository returnItems;
    public WarehouseWorkViewMapper(MaterialIssueRequestItemRepository issueItems, MaterialReturnItemRepository returnItems) {
        this.issueItems = issueItems;
        this.returnItems = returnItems;
    }

    public RequestPage requestPage(Page<MaterialIssueRequest> result) {
        List<Long> ids = result.getContent().stream().map(MaterialIssueRequest::getId).toList();
        Map<Long, List<MaterialIssueRequestItem>> grouped = ids.isEmpty() ? Map.of()
                : issueItems.findByRequest_IdInOrderByRequest_IdAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(item -> item.getRequest().getId()));
        return new RequestPage(result.getContent().stream()
                .map(row -> requestView(row, grouped.getOrDefault(row.getId(), List.of()))).toList(),
                result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize());
    }

    public ReturnPage returnPage(Page<MaterialReturn> result) {
        List<Long> ids = result.getContent().stream().map(MaterialReturn::getId).toList();
        Map<Long, List<MaterialReturnItem>> grouped = ids.isEmpty() ? Map.of()
                : returnItems.findByMaterialReturn_IdInOrderByMaterialReturn_IdAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(item -> item.getMaterialReturn().getId()));
        return new ReturnPage(result.getContent().stream()
                .map(row -> returnView(row, grouped.getOrDefault(row.getId(), List.of()))).toList(),
                result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize());
    }

    public RequestView requestView(MaterialIssueRequest request, List<MaterialIssueRequestItem> items) {
        return new RequestView(request.getId(), request.getRequestCode(), request.getPlan().getId(),
                request.getPlan().getPlanCode(), request.getEmployee().getEmployeeId(),
                request.getEmployee().getAccount().getFullName(), request.getStatus(), request.getEmployeeNote(),
                request.getRequestedAt(), request.getDecidedBy(), request.getDecidedAt(), request.getDecisionNote(),
                items.stream().map(item -> materialView(item.getPlanMaterial(), item.getQuantity())).toList());
    }

    public ReturnView returnView(MaterialReturn materialReturn, List<MaterialReturnItem> items) {
        return new ReturnView(materialReturn.getId(), materialReturn.getReturnCode(), materialReturn.getPlan().getId(),
                materialReturn.getPlan().getPlanCode(), materialReturn.getEmployee().getEmployeeId(),
                materialReturn.getEmployee().getAccount().getFullName(), materialReturn.getStatus(),
                materialReturn.getEmployeeNote(), materialReturn.getRequestedAt(), materialReturn.getDecidedBy(),
                materialReturn.getDecidedAt(), materialReturn.getDecisionNote(),
                items.stream().map(item -> materialView(item.getPlanMaterial(), item.getQuantity())).toList());
    }

    public static MaterialView materialView(ProductionPlanMaterial line, BigDecimal quantity) {
        return new MaterialView(line.getId(), line.getMaterial().getId(), line.getMaterialCode(),
                line.getMaterialName(), line.getUnit(), quantity);
    }

    public RunView runView(ProductionRun run) {
        return new RunView(run.getId(), run.getRunCode(), run.getPlan().getId(), run.getEmployee().getEmployeeId(),
                run.getEmployee().getAccount().getFullName(), run.getProducedQuantity(), run.getNote(), run.getCreatedAt(),
                run.getConsumptions().stream().map(item -> new ConsumptionView(item.getPlanMaterial().getId(),
                        item.getMaterialCode(), item.getMaterialName(), item.getUnit(), item.getQuantity())).toList());
    }
}
