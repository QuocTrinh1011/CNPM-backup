package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.InventoryItemType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.entity.RawMaterial;
import com.cnpm.clothingstore.entity.RawMaterialReceipt;
import com.cnpm.clothingstore.entity.RawMaterialReceiptItem;
import com.cnpm.clothingstore.entity.Supplier;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.RawMaterialReceiptRepository;
import com.cnpm.clothingstore.repository.RawMaterialRepository;
import com.cnpm.clothingstore.repository.SupplierRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RawMaterialReceiptService {
    private static final BigDecimal MAX_MONEY = new BigDecimal("9999999999999.99");
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999999.999");
    private final RawMaterialReceiptRepository receipts;
    private final RawMaterialRepository materials;
    private final SupplierRepository suppliers;
    private final InventoryMovementService movements;
    private final AuditTrail audit;

    public RawMaterialReceiptService(RawMaterialReceiptRepository receipts, RawMaterialRepository materials,
                                     SupplierRepository suppliers, InventoryMovementService movements,
                                     AuditTrail audit) {
        this.receipts = receipts;
        this.materials = materials;
        this.suppliers = suppliers;
        this.movements = movements;
        this.audit = audit;
    }

    @Transactional
    public View receive(CreateRequest request) {
        validateRequest(request);
        if (request.receivedAt().isAfter(Instant.now())) throw invalid("Ngày nhận nguyên liệu không được ở tương lai.");

        Supplier supplier = suppliers.findById(request.supplierId()).filter(item -> item.active)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp đang hoạt động."));
        AuditTrail.Actor actor = AuditTrail.actor();
        if (actor == null || actor.id() == null) throw new IllegalStateException("Authenticated warehouse actor required");

        List<ItemInput> requestedLines = request.items();
        Set<Long> materialIds = new HashSet<>();
        for (ItemInput line : requestedLines) validateLine(line, materialIds);
        List<ItemInput> lines = requestedLines.stream()
                .sorted(Comparator.comparing(ItemInput::materialId))
                .toList();

        Map<Long, RawMaterial> lockedMaterials = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO.setScale(2);
        for (ItemInput line : lines) {
            RawMaterial material = materials.findByIdForUpdate(line.materialId())
                    .filter(RawMaterial::isActive)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RAW_MATERIAL_NOT_FOUND", "Không tìm thấy nguyên liệu đang hoạt động."));
            BigDecimal balance = material.getAvailableQuantity().add(line.quantity()).setScale(3, RoundingMode.UNNECESSARY);
            if (balance.compareTo(MAX_QUANTITY) > 0) throw invalid("Số lượng tồn nguyên liệu vượt giới hạn.");
            lockedMaterials.put(material.getId(), material);
            total = total.add(line.quantity().multiply(line.unitCost()).setScale(2, RoundingMode.HALF_UP));
            if (total.compareTo(MAX_MONEY) > 0) throw invalid("Tổng tiền phiếu nhập vượt giới hạn.");
        }

        RawMaterialReceipt receipt = new RawMaterialReceipt();
        receipt.setReceiptCode("RM-" + UUID.randomUUID().toString().replace("-", ""));
        receipt.setSupplier(supplier);
        receipt.setSupplierCode(supplier.code);
        receipt.setSupplierName(supplier.name);
        receipt.setReceivedAt(request.receivedAt());
        receipt.setNote(normalizeNote(request.note()));
        receipt.setCreatedBy(actor.id());
        receipt.setCreatedAt(Instant.now());
        receipt.setTotalCost(total);

        for (ItemInput line : lines) {
            RawMaterial material = lockedMaterials.get(line.materialId());
            BigDecimal quantity = line.quantity().setScale(3, RoundingMode.UNNECESSARY);
            BigDecimal unitCost = line.unitCost().setScale(2, RoundingMode.UNNECESSARY);
            RawMaterialReceiptItem item = new RawMaterialReceiptItem();
            item.setMaterial(material);
            item.setMaterialCode(material.getCode());
            item.setMaterialName(material.getName());
            item.setUnit(material.getUnit());
            item.setQuantity(quantity);
            item.setUnitCost(unitCost);
            item.setLineTotal(quantity.multiply(unitCost).setScale(2, RoundingMode.HALF_UP));
            receipt.addItem(item);
        }
        RawMaterialReceipt saved = receipts.saveAndFlush(receipt);

        for (ItemInput line : lines) {
            RawMaterial material = lockedMaterials.get(line.materialId());
            BigDecimal quantity = line.quantity().setScale(3, RoundingMode.UNNECESSARY);
            BigDecimal balance = material.getAvailableQuantity().add(quantity).setScale(3, RoundingMode.UNNECESSARY);
            material.setAvailableQuantity(balance);
            material.setUpdatedAt(Instant.now());
            materials.save(material);
            movements.recordChange(InventoryItemType.MATERIAL, material.getId(),
                    InventoryLocation.RAW_MATERIAL_AVAILABLE, null, quantity, balance,
                    InventoryMovementType.RAW_MATERIAL_RECEIPT, "RAW_MATERIAL_RECEIPT", saved.getId());
        }

        audit.record("RECEIVE", "RAW_MATERIAL_RECEIPT", saved.getId(), java.util.Map.of(),
                java.util.Map.of("receiptCode", saved.getReceiptCode(), "supplierId", supplier.id,
                        "supplierName", supplier.name, "totalCost", total, "itemCount", saved.getItems().size()));
        return view(saved, true);
    }

    @Transactional(readOnly = true)
    public PageView list(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw invalid("Tham số phân trang không hợp lệ.");
        var result = receipts.findAllByOrderByReceivedAtDescIdDesc(
                PageRequest.of(page, size, Sort.unsorted()));
        List<View> content = result.getContent().stream().map(row -> view(row, false)).toList();
        return new PageView(content, result.getTotalElements(), result.getTotalPages(), page, size);
    }

    @Transactional(readOnly = true)
    public View detail(Long id) {
        RawMaterialReceipt receipt = receipts.findById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "RAW_MATERIAL_RECEIPT_NOT_FOUND", "Không tìm thấy phiếu nhập nguyên liệu."));
        return view(receipt, true);
    }

    private View view(RawMaterialReceipt receipt, boolean includeItems) {
        List<ItemView> items = includeItems ? receipt.getItems().stream()
                .map(item -> new ItemView(item.getId(), item.getMaterial().getId(), item.getMaterialCode(),
                        item.getMaterialName(), item.getUnit(), item.getQuantity(), item.getUnitCost(), item.getLineTotal()))
                .toList() : List.of();
        int itemCount = includeItems ? items.size() : Math.toIntExact(receipts.countItemsByReceiptId(receipt.getId()));
        return new View(receipt.getId(), receipt.getReceiptCode(), receipt.getSupplier().id,
                receipt.getSupplierCode(), receipt.getSupplierName(), receipt.getReceivedAt(), receipt.getStatus(),
                receipt.getTotalCost(), receipt.getNote(), receipt.getCreatedBy(), receipt.getCreatedAt(), itemCount, items);
    }

    private static void validateRequest(CreateRequest request) {
        if (request == null || request.supplierId() == null || request.supplierId() < 1
                || request.receivedAt() == null || request.items() == null || request.items().isEmpty()
                || request.items().size() > 100) {
            throw invalid("Nhập nhà cung cấp, ngày nhận và ít nhất một nguyên liệu.");
        }
        if (request.note() != null && request.note().length() > 2000) throw invalid("Ghi chú phiếu nhập quá dài.");
    }

    private static void validateLine(ItemInput line, Set<Long> materialIds) {
        if (line == null || line.materialId() == null || line.materialId() < 1
                || line.quantity() == null || line.quantity().signum() <= 0 || line.quantity().scale() > 3
                || line.quantity().precision() > 15 || line.quantity().compareTo(MAX_QUANTITY) > 0
                || line.unitCost() == null || line.unitCost().signum() < 0 || line.unitCost().scale() > 2
                || line.unitCost().precision() > 15 || line.unitCost().compareTo(MAX_MONEY) > 0
                || !materialIds.add(line.materialId())) {
            throw invalid("Mỗi nguyên liệu chỉ được nhập một lần; số lượng phải dương, tối đa 3 số thập phân và đơn giá tối đa 2 số thập phân.");
        }
        BigDecimal lineTotal = line.quantity().multiply(line.unitCost()).setScale(2, RoundingMode.HALF_UP);
        if (lineTotal.compareTo(MAX_MONEY) > 0) throw invalid("Thành tiền dòng vượt giới hạn.");
    }

    private static String normalizeNote(String note) {
        if (note == null) return null;
        String normalized = note.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RAW_MATERIAL_RECEIPT", message);
    }

    public record CreateRequest(@NotNull @Positive Long supplierId, @NotNull Instant receivedAt,
                                @Size(max = 2000) String note,
                                @NotEmpty @Size(max = 100) List<@NotNull @Valid ItemInput> items) {}
    public record ItemInput(@NotNull @Positive Long materialId,
                            @NotNull @DecimalMin(value = "0.000", inclusive = false)
                            @Digits(integer = 12, fraction = 3) BigDecimal quantity,
                            @NotNull @DecimalMin("0.00") @Digits(integer = 13, fraction = 2) BigDecimal unitCost) {}
    public record ItemView(Long id, Long materialId, String materialCode, String materialName, String unit,
                           BigDecimal quantity, BigDecimal unitCost, BigDecimal lineTotal) {}
    public record View(Long id, String receiptCode, Long supplierId, String supplierCode, String supplierName,
                       Instant receivedAt, String status, BigDecimal totalCost, String note, Long createdBy,
                       Instant createdAt, Integer itemCount, List<ItemView> items) {}
    public record PageView(List<View> content, long totalElements, int totalPages, int number, int size) {}
}
