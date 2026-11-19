package com.htttdn.crm.service.warehouse;

import com.htttdn.crm.entity.ProductionPlanMaterial;
import com.htttdn.crm.exception.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import com.htttdn.crm.service.*;
import com.htttdn.crm.service.WarehouseWorkService.*;

public final class WarehouseWorkValidator {
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999999.999");
    public static Map<Long, ProductionPlanMaterial> indexLines(List<ProductionPlanMaterial> lines) {
        return lines.stream().collect(Collectors.toMap(ProductionPlanMaterial::getId, Function.identity()));
    }

    public static List<LineInput> validateLines(List<LineInput> lines) {
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

    public static BigDecimal normalize(BigDecimal amount) {
        return amount.setScale(3, RoundingMode.UNNECESSARY);
    }

    public static Decision validateDecision(DecisionInput input) {
        if (input == null || input.decision() == null
                || !("APPROVE".equals(input.decision()) || "REJECT".equals(input.decision()))
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Quyết định phải là APPROVE hoặc REJECT; ghi chú tối đa 2000 ký tự.");
        }
        return new Decision("APPROVE".equals(input.decision()), input.note());
    }

    public static AuditTrail.Actor requireActor() {
        AuditTrail.Actor actor = AuditTrail.actor();
        if (actor == null || actor.id() == null) throw new IllegalStateException("Authenticated warehouse actor required");
        return actor;
    }

    public static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw invalid("Tham số phân trang không hợp lệ.");
        return PageRequest.of(page, size, Sort.unsorted());
    }

    public static String normalizeNote(String note) {
        if (note == null) return null;
        String normalized = note.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    public static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WAREHOUSE_WORK", message);
    }

    public static ApiException notFound(String code, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message);
    }
    public record Decision(boolean approved, String note) {}

}
