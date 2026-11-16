package com.htttdn.crm.service;

import com.htttdn.crm.entity.Category;
import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.InventoryItemType;
import com.htttdn.crm.entity.InventoryLocation;
import com.htttdn.crm.entity.InventoryMovement;
import com.htttdn.crm.entity.InventoryMovementType;
import com.htttdn.crm.entity.Product;
import com.htttdn.crm.entity.Supplier;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.repository.CategoryRepository;
import com.htttdn.crm.repository.EmployeeProfileRepository;
import com.htttdn.crm.repository.InventoryMovementRepository;
import com.htttdn.crm.repository.ProductRepository;
import com.htttdn.crm.repository.SupplierRepository;
import com.htttdn.crm.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:finishedGoodsTransfer;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class FinishedGoodsTransferIntegrationTest {
    private static final String PASSWORD = "WarehouseTest123!";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired EmployeeProfileRepository profiles;
    @Autowired CategoryRepository categories;
    @Autowired ProductRepository products;
    @Autowired SupplierRepository suppliers;
    @Autowired InventoryMovementRepository movements;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired AuthService customerAuth;

    private User warehouseManager;
    private User hrManager;
    private User warehouseEmployee;
    private User otherWarehouseEmployee;
    private User generalEmployee;
    private String warehouseManagerToken;
    private String hrManagerToken;
    private String employeeToken;
    private String otherEmployeeToken;
    private String generalEmployeeToken;

    @BeforeEach
    void setUp() {
        warehouseManager = user("MANAGER_WAREHOUSE", "warehouse-manager");
        hrManager = user("MANAGER_HR", "hr-manager");
        warehouseManagerToken = loginManager(warehouseManager);
        hrManagerToken = loginManager(hrManager);
        warehouseEmployee = employee("WAREHOUSE", "warehouse-employee");
        otherWarehouseEmployee = employee("WAREHOUSE", "warehouse-employee-other");
        generalEmployee = employee("GENERAL", "general-employee");
        employeeToken = loginManager(warehouseEmployee);
        otherEmployeeToken = loginManager(otherWarehouseEmployee);
        generalEmployeeToken = loginManager(generalEmployee);
    }

    @Test
    void employeeRequestsFinishedGoodsAndManagerTransfersStockExactlyOnce() throws Exception {
        long productId = createProduct(2);
        openFinishedStock(productId, 6);
        assertMovementBalance(productId, InventoryLocation.SELLABLE, "2.000");

        mvc.perform(get("/api/manager/warehouse/me/finished-goods-requests")
                        .header("Authorization", employeeToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        mvc.perform(get("/api/manager/warehouse/me/finished-goods-requests")
                        .header("Authorization", otherEmployeeToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        mvc.perform(get("/api/manager/warehouse/me/finished-goods-requests")
                        .header("Authorization", generalEmployeeToken))
                .andExpect(status().isForbidden());

        String pending = mvc.perform(post("/api/manager/warehouse/me/finished-goods-requests")
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content(finishedGoodsRequest(productId, 4)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.employeeId").value(warehouseEmployee.getId()))
                .andReturn().getResponse().getContentAsString();
        long requestId = jsonLong(pending, "$.id");
        mvc.perform(get("/api/manager/warehouse/me/finished-goods-requests")
                        .header("Authorization", employeeToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(requestId));
        mvc.perform(get("/api/manager/warehouse/me/finished-goods-requests")
                        .header("Authorization", otherEmployeeToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        mvc.perform(get("/api/manager/warehouse/finished-goods-requests")
                        .header("Authorization", hrManagerToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/manager/warehouse/finished-goods-requests")
                        .header("Authorization", warehouseManagerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(requestId));

        mvc.perform(patch("/api/manager/warehouse/finished-goods-requests/{id}/decision", requestId)
                        .header("Authorization", hrManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decision("APPROVE")))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/manager/warehouse/finished-goods-requests/{id}/decision", requestId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decision("APPROVE")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        assertEquals(2, finishedStockQuantity(productId));
        assertEquals(6, products.findById(productId).orElseThrow().getStock());
        assertMovementBalance(productId, InventoryLocation.FINISHED_WAREHOUSE, "2.000");
        assertMovementBalance(productId, InventoryLocation.SELLABLE, "6.000");
        var transfer = movements.findAllByMovementTypeAndReferenceTypeAndReferenceId(
                InventoryMovementType.FINISHED_GOODS_TRANSFER, "FINISHED_GOODS_REQUEST", requestId);
        assertEquals(2, transfer.size());
        assertEquals(new BigDecimal("-4.000"), transfer.stream()
                .filter(row -> row.getLocation() == InventoryLocation.FINISHED_WAREHOUSE)
                .findFirst().orElseThrow().getQuantityDelta());
        assertEquals(new BigDecimal("4.000"), transfer.stream()
                .filter(row -> row.getLocation() == InventoryLocation.SELLABLE)
                .findFirst().orElseThrow().getQuantityDelta());
        mvc.perform(patch("/api/manager/warehouse/finished-goods-requests/{id}/decision", requestId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decision("REJECT")))
                .andExpect(status().isBadRequest());

        String insufficient = mvc.perform(post("/api/manager/warehouse/me/finished-goods-requests")
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content(finishedGoodsRequest(productId, 3)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long insufficientId = jsonLong(insufficient, "$.id");
        mvc.perform(patch("/api/manager/warehouse/finished-goods-requests/{id}/decision", insufficientId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decision("APPROVE")))
                .andExpect(status().isBadRequest());
        assertEquals(2, finishedStockQuantity(productId));
        assertEquals(6, products.findById(productId).orElseThrow().getStock());
        mvc.perform(patch("/api/manager/warehouse/finished-goods-requests/{id}/decision", insufficientId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decision("REJECT")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
    }

    @Test
    void sellableLedgerTracksProductChangesReceiptsCheckoutAndOrderRelease() throws Exception {
        long productId = createProduct(5);
        mvc.perform(put("/api/manager/products/{id}", productId).header("Authorization", warehouseManagerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(productJson("Ledger product", 8)))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/manager/products/{id}/stock", productId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":10}"))
                .andExpect(status().isOk());

        Supplier supplier = new Supplier();
        supplier.code = "LEDGER-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        supplier.name = "Inventory ledger supplier";
        supplier = suppliers.saveAndFlush(supplier);
        mvc.perform(post("/api/manager/stock-receipts").header("Authorization", warehouseManagerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(stockReceiptJson(supplier.id, productId, 4)))
                .andExpect(status().isCreated());
        assertEquals(14, products.findById(productId).orElseThrow().getStock());

        User customer = user("CUSTOMER", "inventory-customer");
        var session = customerAuth.login(customer.getEmail(), PASSWORD);
        String customerToken = "Bearer " + session.accessToken();
        String createdOrder = mvc.perform(post("/api/orders").header("Authorization", customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deliveryAddress\":\"Test address\",\"paymentMethod\":\"COD\","
                                + "\"items\":[{\"productId\":" + productId + ",\"quantity\":2}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long orderId = jsonLong(createdOrder, "$.order.id");
        assertEquals(12, products.findById(productId).orElseThrow().getStock());
        mvc.perform(patch("/api/orders/{id}/cancel", orderId).header("Authorization", customerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Test rollback\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        assertEquals(14, products.findById(productId).orElseThrow().getStock());

        assertMovementBalance(productId, InventoryLocation.SELLABLE, "14.000");
        var rows = movements.findAllByItemTypeAndItemIdAndLocationAndScopeIdOrderByIdAsc(
                InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, null);
        assertEquals(List.of("OPENING", "SELLABLE_ADJUSTMENT", "SELLABLE_ADJUSTMENT",
                        "PRODUCT_RECEIPT", "SALE_RESERVATION", "SALE_RELEASE"),
                rows.stream().map(row -> row.getMovementType().name()).toList());
        assertEquals(new BigDecimal("-2.000"), rows.get(4).getQuantityDelta());
        assertEquals(new BigDecimal("2.000"), rows.get(5).getQuantityDelta());
    }

    private long createProduct(int stock) throws Exception {
        String response = mvc.perform(post("/api/manager/products").header("Authorization", warehouseManagerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(productJson("Ledger product", stock)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return jsonLong(response, "$.id");
    }

    private String productJson(String name, int stock) {
        return "{\"name\":\"" + name + "\",\"category\":\"Ledger category\",\"description\":\"Test\","
                + "\"price\":100000,\"stock\":" + stock + ",\"imageUrl\":\"https://cdn.example/test.jpg\"}";
    }

    private static String finishedGoodsRequest(long productId, int quantity) {
        return "{\"items\":[{\"productId\":" + productId + ",\"quantity\":" + quantity + "}]}";
    }

    private static String stockReceiptJson(long supplierId, long productId, int quantity) {
        return "{\"supplierId\":" + supplierId + ",\"receivedAt\":\"" + Instant.now().minusSeconds(30)
                + "\",\"items\":[{\"productId\":" + productId + ",\"quantity\":" + quantity
                + ",\"unitCost\":10000.00}]}";
    }

    private static String decision(String status) { return "{\"decision\":\"" + status + "\"}"; }

    private void openFinishedStock(long productId, int quantity) {
        jdbc.update("INSERT INTO warehouse_finished_stock (product_id, quantity, updated_at) VALUES (?, ?, ?)",
                productId, quantity, Instant.now());
        InventoryMovement opening = new InventoryMovement();
        opening.setItemType(InventoryItemType.PRODUCT);
        opening.setItemId(productId);
        opening.setLocation(InventoryLocation.FINISHED_WAREHOUSE);
        opening.setQuantityDelta(BigDecimal.valueOf(quantity));
        opening.setQuantityAfter(BigDecimal.valueOf(quantity));
        opening.setMovementType(InventoryMovementType.OPENING);
        opening.setReferenceType("TEST_FINISHED_OPENING");
        opening.setReferenceId(productId);
        opening.setActorName("Warehouse test fixture");
        opening.setActorRole("SYSTEM");
        movements.saveAndFlush(opening);
    }

    private int finishedStockQuantity(long productId) {
        return jdbc.queryForObject("SELECT quantity FROM warehouse_finished_stock WHERE product_id = ?", Integer.class,
                productId);
    }

    private void assertMovementBalance(long productId, InventoryLocation location, String expected) {
        BigDecimal sum = movements.findAllByItemTypeAndItemIdAndLocationAndScopeIdOrderByIdAsc(
                        InventoryItemType.PRODUCT, productId, location, null).stream()
                .map(InventoryMovement::getQuantityDelta).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(new BigDecimal(expected), sum.setScale(3));
    }

    private User employee(String workArea, String prefix) {
        User user = user("EMPLOYEE", prefix);
        EmployeeProfile profile = new EmployeeProfile();
        profile.setEmployeeId(user.getId());
        profile.setAccount(user);
        profile.setEmployeeCode("EMP-" + UUID.randomUUID());
        profile.setJobTitle("Warehouse worker");
        profile.setHireDate(LocalDate.of(2025, 1, 1));
        profile.setWorkArea(workArea);
        profiles.saveAndFlush(profile);
        return user;
    }

    private User user(String role, String prefix) {
        User user = new User();
        user.setEmail(prefix + "-" + UUID.randomUUID() + "@finished-goods.test");
        user.setFullName(prefix);
        user.setPasswordHash(encoder.encode(PASSWORD));
        user.setRole(role);
        return users.saveAndFlush(user);
    }

    private String loginManager(User user) { return "Bearer " + managerAuth.login(user.getEmail(), PASSWORD).accessToken(); }
    private static long jsonLong(String json, String expression) {
        return ((Number) com.jayway.jsonpath.JsonPath.read(json, expression)).longValue();
    }
}
