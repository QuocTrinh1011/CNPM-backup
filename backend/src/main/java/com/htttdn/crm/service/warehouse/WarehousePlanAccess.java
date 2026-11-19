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

public final class WarehousePlanAccess {
    private final ProductionPlanRepository plans;
    private final RawMaterialRepository materials;
    public WarehousePlanAccess(ProductionPlanRepository plans, RawMaterialRepository materials) {
        this.plans = plans;
        this.materials = materials;
    }

    public ProductionPlan lockEmployeePlan(EmployeeProfile employee, Long planId) {
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

    public List<RawMaterial> lockMaterials(List<Long> ids) {
        List<Long> orderedIds = ids.stream().distinct().sorted().toList();
        if (orderedIds.isEmpty()) return List.of();
        return materials.findAllByIdInForUpdate(orderedIds);
    }
}
