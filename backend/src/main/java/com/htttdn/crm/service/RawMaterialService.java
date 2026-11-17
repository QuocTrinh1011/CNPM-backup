package com.htttdn.crm.service;

import com.htttdn.crm.entity.RawMaterial;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.RawMaterialRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RawMaterialService {
    private final RawMaterialRepository materials;
    private final AuditTrail audit;

    public RawMaterialService(RawMaterialRepository materials, AuditTrail audit) {
        this.materials = materials;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<View> list() {
        return materials.findAll(Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id")))
                .stream().map(RawMaterialService::view).toList();
    }

    @Transactional
    public View create(CreateRequest request) {
        if (request == null) throw invalid("Nhập mã, tên và đơn vị nguyên liệu.");
        String code = normalizeCode(request.code());
        String name = normalize(request.name());
        String unit = normalize(request.unit());
        validate(code, name, unit);
        if (materials.findByCodeIgnoreCase(code).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "RAW_MATERIAL_CODE_EXISTS", "Mã nguyên liệu đã tồn tại.");
        }

        RawMaterial material = new RawMaterial();
        material.setCode(code);
        material.setName(name);
        material.setUnit(unit);
        material.setAvailableQuantity(BigDecimal.ZERO.setScale(3));
        material.setActive(true);
        material.setCreatedAt(Instant.now());
        material.setUpdatedAt(Instant.now());
        RawMaterial saved = materials.saveAndFlush(material);
        audit.record("CREATE", "RAW_MATERIAL", saved.getId(), java.util.Map.of(), AuditTrail.snapshot(saved));
        return view(saved);
    }

    @Transactional
    public View update(Long id, UpdateRequest request) {
        if (id == null || id < 1 || request == null) throw invalid("Thông tin nguyên liệu không hợp lệ.");
        RawMaterial material = materials.findByIdForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RAW_MATERIAL_NOT_FOUND", "Không tìm thấy nguyên liệu."));
        var before = AuditTrail.snapshot(material);
        if (request.name() != null) {
            String name = normalize(request.name());
            if (name.isEmpty() || name.length() > 150) throw invalid("Tên nguyên liệu không hợp lệ.");
            material.setName(name);
        }
        if (request.active() != null) material.setActive(request.active());
        material.setUpdatedAt(Instant.now());
        RawMaterial saved = materials.saveAndFlush(material);
        audit.record("UPDATE", "RAW_MATERIAL", saved.getId(), before, AuditTrail.snapshot(saved));
        return view(saved);
    }

    private static void validate(String code, String name, String unit) {
        if (code.isEmpty() || code.length() > 40 || !code.matches("[A-Z0-9_-]+")
                || name.isEmpty() || name.length() > 150 || unit.isEmpty() || unit.length() > 24) {
            throw invalid("Mã, tên hoặc đơn vị nguyên liệu không hợp lệ.");
        }
    }

    private static String normalizeCode(String value) {
        return normalize(value).toUpperCase(Locale.ROOT);
    }

    private static String normalize(String value) { return value == null ? "" : value.trim(); }

    private static View view(RawMaterial material) {
        return new View(material.getId(), material.getCode(), material.getName(), material.getUnit(),
                material.getAvailableQuantity(), material.isActive(), material.getCreatedAt(), material.getUpdatedAt());
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RAW_MATERIAL", message);
    }

    public record CreateRequest(@NotBlank @Size(max = 40) String code,
                                @NotBlank @Size(max = 150) String name,
                                @NotBlank @Size(max = 24) String unit) {}
    public record UpdateRequest(@Size(max = 150) String name, Boolean active) {}
    public record View(Long id, String code, String name, String unit, BigDecimal availableQuantity,
                       boolean active, Instant createdAt, Instant updatedAt) {}
}
