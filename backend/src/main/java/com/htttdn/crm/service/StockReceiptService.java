package com.htttdn.crm.service;

import com.htttdn.crm.entity.Product;
import com.htttdn.crm.entity.StockReceipt;
import com.htttdn.crm.entity.StockReceiptItem;
import com.htttdn.crm.entity.Supplier;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.ProductRepository;
import com.htttdn.crm.repository.StockReceiptRepository;
import com.htttdn.crm.repository.SupplierRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Service
public class StockReceiptService extends AdminServiceSupport {
    private static final BigDecimal MAX_MONEY = new BigDecimal("9999999999999.99");
    private final StockReceiptRepository receipts;
    private final SupplierRepository suppliers;
    private final ProductRepository products;
    private final StockService stock;

    public StockReceiptService(StockReceiptRepository receipts, SupplierRepository suppliers,
                               ProductRepository products, StockService stock) {
        this.receipts = receipts;
        this.suppliers = suppliers;
        this.products = products;
        this.stock = stock;
    }

    @Transactional
    public View receive(CreateRequest request) {
        if (request == null || request.supplierId() == null || request.receivedAt() == null
                || request.items() == null || request.items().isEmpty() || request.items().size() > 100)
            throw invalid("Nhập nhà cung cấp, ngày nhận và ít nhất một sản phẩm.");
        if (request.receivedAt().isAfter(Instant.now())) throw invalid("Ngày nhận hàng không được ở tương lai.");

        Supplier supplier = suppliers.findById(request.supplierId()).filter(s -> s.active)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp đang hoạt động."));
        Set<Long> productIds = new HashSet<>();
        for (ItemInput line : request.items()) {
            if (line == null || line.productId() == null || line.productId() < 1 || line.quantity() == null
                    || line.quantity() < 1 || line.quantity() > 1_000_000 || line.unitCost() == null
                    || line.unitCost().signum() < 0 || line.unitCost().scale() > 2
                    || line.unitCost().compareTo(MAX_MONEY) > 0 || !productIds.add(line.productId()))
                throw invalid("Mỗi sản phẩm chỉ được nhập một lần; số lượng phải dương và đơn giá tối đa 2 chữ số thập phân.");
        }

        StockReceipt receipt = new StockReceipt();
        receipt.setReceiptCode("PN-" + UUID.randomUUID());
        receipt.setSupplier(supplier);
        receipt.setSupplierCode(supplier.code);
        receipt.setSupplierName(supplier.name);
        receipt.setReceivedAt(request.receivedAt());
        receipt.setNote(request.note() == null ? null : request.note().trim());
        receipt.setCreatedAt(Instant.now());
        AuditTrail.Actor actor = AuditTrail.actor();
        receipt.setCreatedBy(actor == null ? null : actor.id());

        BigDecimal total = BigDecimal.ZERO;
        for (ItemInput input : request.items().stream().sorted(Comparator.comparing(ItemInput::productId)).toList()) {
            Product product = stock.lockProduct(input.productId())
                    .filter(Product::isActive)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm đang kinh doanh."));
            int beforeStock = product.getStock();
            try {
                product.setStock(Math.addExact(beforeStock, input.quantity()));
            } catch (ArithmeticException ex) {
                throw new ApiException(HttpStatus.CONFLICT, "STOCK_LIMIT_EXCEEDED", "Số lượng tồn kho vượt giới hạn.");
            }
            product.setUpdatedAt(Instant.now());
            products.save(product);
            audit("STOCK_RECEIVED", "PRODUCT", product.getId(),
                    Map.of("stock", beforeStock, "name", product.getName()), product);

            BigDecimal unitCost = input.unitCost().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unitCost.multiply(BigDecimal.valueOf(input.quantity())).setScale(2, RoundingMode.HALF_UP);
            total = total.add(lineTotal);
            if (total.compareTo(MAX_MONEY) > 0) throw invalid("Tổng giá trị phiếu nhập vượt giới hạn.");

            StockReceiptItem item = new StockReceiptItem();
            item.setProduct(product);
            item.setProductName(product.getName());
            item.setQuantity(input.quantity());
            item.setUnitCost(unitCost);
            item.setLineTotal(lineTotal);
            receipt.addItem(item);
        }
        receipt.setTotalCost(total);
        StockReceipt saved = receipts.saveAndFlush(receipt);
        audit("RECEIVE", "STOCK_RECEIPT", saved.getId(), Map.of(), saved);
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
        StockReceipt receipt = receipts.findById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "STOCK_RECEIPT_NOT_FOUND", "Không tìm thấy phiếu nhập."));
        return view(receipt, true);
    }

    private View view(StockReceipt receipt, boolean includeItems) {
        List<ItemView> items = includeItems ? receipt.getItems().stream()
                .map(item -> new ItemView(item.getId(), item.getProduct().getId(), item.getProductName(),
                        item.getQuantity(), item.getUnitCost(), item.getLineTotal())).toList() : List.of();
        return new View(receipt.getId(), receipt.getReceiptCode(), receipt.getSupplier().id,
                receipt.getSupplierCode(), receipt.getSupplierName(), receipt.getReceivedAt(), receipt.getStatus(),
                receipt.getTotalCost(), receipt.getNote(), receipt.getCreatedBy(), receipt.getCreatedAt(),
                includeItems ? items.size() : Math.toIntExact(receipts.countItemsByReceiptId(receipt.getId())), items);
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STOCK_RECEIPT", message);
    }

    public record CreateRequest(@NotNull @Positive Long supplierId, @NotNull Instant receivedAt,
                                @Size(max = 2000) String note,
                                @NotEmpty @Size(max = 100) List<@NotNull @Valid ItemInput> items) {}
    public record ItemInput(@NotNull @Positive Long productId,
                            @NotNull @Min(1) @Max(1_000_000) Integer quantity,
                            @NotNull @DecimalMin("0.00") @Digits(integer = 13, fraction = 2) BigDecimal unitCost) {}
    public record ItemView(Long id, Long productId, String productName, int quantity,
                           BigDecimal unitCost, BigDecimal lineTotal) {}
    public record View(Long id, String receiptCode, Long supplierId, String supplierCode, String supplierName,
                       Instant receivedAt, String status, BigDecimal totalCost, String note, Long createdBy,
                       Instant createdAt, Integer itemCount, List<ItemView> items) {}
    public record PageView(List<View> content, long totalElements, int totalPages, int number, int size) {}
}
