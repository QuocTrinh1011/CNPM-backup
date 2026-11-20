package com.cnpm.clothingstore.service.warehouse;

import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.ProductionPlan;
import com.cnpm.clothingstore.entity.RawMaterial;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.ProductionPlanRepository;
import com.cnpm.clothingstore.repository.RawMaterialRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import com.cnpm.clothingstore.service.*;
import com.cnpm.clothingstore.service.WarehouseWorkService.*;
import static com.cnpm.clothingstore.service.warehouse.WarehouseWorkValidator.*;

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
