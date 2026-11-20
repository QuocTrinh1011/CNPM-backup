package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.FinishedGoodsIssueRequest;
import com.cnpm.clothingstore.entity.FinishedGoodsIssueRequestItem;
import com.cnpm.clothingstore.entity.InventoryItemType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.entity.Product;
import com.cnpm.clothingstore.entity.WarehouseFinishedStock;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.FinishedGoodsIssueRequestItemRepository;
import com.cnpm.clothingstore.repository.FinishedGoodsIssueRequestRepository;
import com.cnpm.clothingstore.repository.ProductRepository;
import com.cnpm.clothingstore.repository.WarehouseFinishedStockRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinishedGoodsTransferService {
    private static final int MAX_LINES = 100;
    private static final int MAX_LINE_QUANTITY = 1_000_000;

    private final FinishedGoodsIssueRequestRepository requests;
    private final FinishedGoodsIssueRequestItemRepository items;
    private final ProductRepository products;
    private final WarehouseFinishedStockRepository finishedStock;
    private final StockService stock;
    private final InventoryMovementService movements;
    private final AuditTrail audit;

    public FinishedGoodsTransferService(FinishedGoodsIssueRequestRepository requests,
                                        FinishedGoodsIssueRequestItemRepository items,
                                        ProductRepository products,
                                        WarehouseFinishedStockRepository finishedStock,
                                        StockService stock,
                                        InventoryMovementService movements,
                                        AuditTrail audit) {
        this.requests = requests;
        this.items = items;
        this.products = products;
        this.finishedStock = finishedStock;
        this.stock = stock;
        this.movements = movements;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public RequestPage myRequests(long employeeId, int page, int size) {
        return page(requests.findAllByEmployee_EmployeeIdOrderByRequestedAtDescIdDesc(
                employeeId, pageRequest(page, size)));
    }

    @Transactional(readOnly = true)
    public RequestPage queue(int page, int size) {
        return page(requests.findAllByOrderByRequestedAtDescIdDesc(pageRequest(page, size)));
    }

    @Transactional
    public RequestView createRequest(EmployeeProfile employee, RequestInput input) {
        List<LineInput> lines = validateLines(input == null ? null : input.items());
        if (input.note() != null && input.note().length() > 2000) {
            throw invalid("Ghi chú tối đa 2000 ký tự.");
        }

        List<Long> productIds = lines.stream().map(LineInput::productId).toList();
        Map<Long, Product> productsById = products.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, product -> product));
        if (productsById.size() != productIds.size()
                || productsById.values().stream().anyMatch(product -> !product.isActive())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND",
                    "Một hoặc nhiều sản phẩm không còn hoạt động.");
        }

        FinishedGoodsIssueRequest request = new FinishedGoodsIssueRequest();
        request.setRequestCode("TP-" + UUID.randomUUID());
        request.setEmployee(employee);
        request.setEmployeeNote(normalizeNote(input.note()));
        request.setRequestedAt(Instant.now());
        for (LineInput line : lines) {
            Product product = productsById.get(line.productId());
            FinishedGoodsIssueRequestItem item = new FinishedGoodsIssueRequestItem();
            item.setProduct(product);
            item.setProductName(product.getName());
            item.setQuantity(line.quantity());
            request.addItem(item);
        }
        FinishedGoodsIssueRequest saved = requests.saveAndFlush(request);
        AuditTrail.Actor actor = new AuditTrail.Actor(employee.getEmployeeId(),
                employee.getAccount().getFullName(), "EMPLOYEE");
        audit.recordAs(actor, "REQUEST", "FINISHED_GOODS_ISSUE_REQUEST", saved.getId(), Map.of(),
                Map.of("status", "PENDING", "itemCount", lines.size()));
        return view(saved, items.findByRequest_IdOrderByIdAsc(saved.getId()));
    }

    @Transactional
    public RequestView decide(Long requestId, DecisionInput input) {
        Decision decision = validateDecision(input);
        FinishedGoodsIssueRequest request = requests.findByIdForUpdate(requestId)
                .orElseThrow(() -> notFound("FINISHED_GOODS_REQUEST_NOT_FOUND", "Không tìm thấy đề nghị xuất thành phẩm."));
        if (!"PENDING".equals(request.getStatus())) throw invalid("Đề nghị đã được xử lý.");
        AuditTrail.Actor actor = requireWarehouseManager();
        List<FinishedGoodsIssueRequestItem> requestItems = items.findByRequest_IdOrderByIdAsc(requestId);

        request.setDecidedBy(actor.id());
        request.setDecidedAt(Instant.now());
        request.setDecisionNote(normalizeNote(decision.note()));
        if (!decision.approved()) {
            request.setStatus("REJECTED");
            FinishedGoodsIssueRequest saved = requests.saveAndFlush(request);
            audit.recordAs(actor, "REJECT", "FINISHED_GOODS_ISSUE_REQUEST", saved.getId(),
                    Map.of("status", "PENDING"), Map.of("status", "REJECTED"));
            return view(saved, requestItems);
        }

        List<Long> productIds = requestItems.stream().map(item -> item.getProduct().getId()).distinct().sorted().toList();
        Map<Long, Product> lockedProducts = new LinkedHashMap<>();
        Map<Long, WarehouseFinishedStock> lockedBalances = new LinkedHashMap<>();
        for (Long productId : productIds) {
            Product product = stock.lockProduct(productId).filter(Product::isActive)
                    .orElseThrow(() -> invalid("Một hoặc nhiều sản phẩm không còn hoạt động."));
            lockedProducts.put(productId, product);
        }
        for (Long productId : productIds) {
            WarehouseFinishedStock balance = finishedStock.findByProductIdForUpdate(productId)
                    .orElseThrow(() -> invalid("Chưa ghi nhận tồn thành phẩm trong kho."));
            lockedBalances.put(productId, balance);
        }

        List<Transfer> transfers = new ArrayList<>();
        for (FinishedGoodsIssueRequestItem item : requestItems) {
            Long productId = item.getProduct().getId();
            Product product = lockedProducts.get(productId);
            WarehouseFinishedStock balance = lockedBalances.get(productId);
            if (balance.getQuantity() < item.getQuantity()) {
                throw invalid("Tồn kho thành phẩm không đủ để duyệt toàn bộ đề nghị.");
            }
            final int sellableAfter;
            try {
                sellableAfter = Math.addExact(product.getStock(), item.getQuantity());
            } catch (ArithmeticException exception) {
                throw new ApiException(HttpStatus.CONFLICT, "STOCK_LIMIT_EXCEEDED",
                        "Tồn bán vượt giới hạn cho phép.");
            }
            transfers.add(new Transfer(item, product, balance, sellableAfter));
        }

        request.setStatus("APPROVED");
        FinishedGoodsIssueRequest saved = requests.saveAndFlush(request);
        for (Transfer transfer : transfers) {
            int quantity = transfer.item().getQuantity();
            WarehouseFinishedStock balance = transfer.balance();
            Product product = transfer.product();
            balance.setQuantity(balance.getQuantity() - quantity);
            balance.setUpdatedAt(Instant.now());
            product.setStock(transfer.sellableAfter());
            product.setUpdatedAt(Instant.now());
            products.save(product);
            movements.recordTransfer(InventoryItemType.PRODUCT, product.getId(),
                    InventoryLocation.FINISHED_WAREHOUSE, null, stockQuantity(balance.getQuantity()),
                    InventoryLocation.SELLABLE, null, stockQuantity(product.getStock()),
                    stockQuantity(quantity), InventoryMovementType.FINISHED_GOODS_TRANSFER,
                    "FINISHED_GOODS_REQUEST", saved.getId());
        }
        audit.recordAs(actor, "APPROVE", "FINISHED_GOODS_ISSUE_REQUEST", saved.getId(),
                Map.of("status", "PENDING"), Map.of("status", "APPROVED", "itemCount", transfers.size()));
        return view(saved, items.findByRequest_IdOrderByIdAsc(saved.getId()));
    }

    private RequestPage page(Page<FinishedGoodsIssueRequest> result) {
        List<Long> ids = result.getContent().stream().map(FinishedGoodsIssueRequest::getId).toList();
        Map<Long, List<FinishedGoodsIssueRequestItem>> itemsByRequest = ids.isEmpty() ? Map.of()
                : items.findByRequest_IdInOrderByRequest_IdAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(item -> item.getRequest().getId(), LinkedHashMap::new,
                        Collectors.toList()));
        List<RequestView> content = result.getContent().stream()
                .map(request -> view(request, itemsByRequest.getOrDefault(request.getId(), List.of()))).toList();
        return new RequestPage(content, result.getTotalElements(), result.getTotalPages(),
                result.getNumber(), result.getSize());
    }

    private static RequestView view(FinishedGoodsIssueRequest request, List<FinishedGoodsIssueRequestItem> items) {
        List<ItemView> itemViews = items.stream().map(item -> new ItemView(item.getProduct().getId(),
                item.getProductName(), item.getQuantity())).toList();
        return new RequestView(request.getId(), request.getRequestCode(), request.getEmployee().getEmployeeId(),
                request.getEmployee().getAccount().getFullName(), request.getEmployee().getAccount().getEmail(),
                request.getStatus(), request.getEmployeeNote(), request.getRequestedAt(), request.getDecidedBy(),
                request.getDecidedAt(), request.getDecisionNote(), itemViews);
    }

    private AuditTrail.Actor requireWarehouseManager() {
        AuditTrail.Actor actor = AuditTrail.actor();
        if (actor == null || actor.id() == null || !"MANAGER_WAREHOUSE".equals(actor.role())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "WAREHOUSE_MANAGER_REQUIRED",
                    "Chỉ quản lý kho được duyệt đề nghị xuất thành phẩm.");
        }
        return actor;
    }

    private static List<LineInput> validateLines(List<LineInput> lines) {
        if (lines == null || lines.isEmpty() || lines.size() > MAX_LINES) {
            throw invalid("Đề nghị cần có từ 1 đến 100 sản phẩm.");
        }
        Set<Long> productIds = new HashSet<>();
        for (LineInput line : lines) {
            if (line == null || line.productId() == null || line.productId() < 1
                    || line.quantity() == null || line.quantity() < 1 || line.quantity() > MAX_LINE_QUANTITY
                    || !productIds.add(line.productId())) {
                throw invalid("Mỗi sản phẩm chỉ được khai báo một lần; số lượng phải từ 1 đến 1.000.000.");
            }
        }
        return lines.stream().sorted(Comparator.comparing(LineInput::productId)).toList();
    }

    private static Decision validateDecision(DecisionInput input) {
        if (input == null || !("APPROVE".equals(input.decision()) || "REJECT".equals(input.decision()))
                || input.note() != null && input.note().length() > 2000) {
            throw invalid("Quyết định phải là APPROVE hoặc REJECT; ghi chú tối đa 2000 ký tự.");
        }
        return new Decision("APPROVE".equals(input.decision()), input.note());
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw invalid("Tham số phân trang không hợp lệ.");
        return PageRequest.of(page, size, Sort.unsorted());
    }

    private static BigDecimal stockQuantity(int quantity) {
        return BigDecimal.valueOf(quantity).setScale(3);
    }

    private static String normalizeNote(String note) {
        if (note == null) return null;
        String normalized = note.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FINISHED_GOODS_REQUEST", message);
    }

    private static ApiException notFound(String code, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message);
    }

    public record LineInput(@NotNull @Positive Long productId,
                            @NotNull @Min(1) @Max(MAX_LINE_QUANTITY) Integer quantity) {}
    public record RequestInput(@NotEmpty @Size(max = MAX_LINES) List<@NotNull @Valid LineInput> items,
                               @Size(max = 2000) String note) {}
    public record DecisionInput(@NotNull String decision, @Size(max = 2000) String note) {}
    public record ItemView(Long productId, String productName, int quantity) {}
    public record RequestView(Long id, String requestCode, Long employeeId, String employeeName, String employeeEmail,
                              String status, String employeeNote, Instant requestedAt, Long decidedBy,
                              Instant decidedAt, String decisionNote, List<ItemView> items) {}
    public record RequestPage(List<RequestView> content, long totalElements, int totalPages, int number, int size) {}

    private record Decision(boolean approved, String note) {}
    private record Transfer(FinishedGoodsIssueRequestItem item, Product product,
                            WarehouseFinishedStock balance, int sellableAfter) {}
}
