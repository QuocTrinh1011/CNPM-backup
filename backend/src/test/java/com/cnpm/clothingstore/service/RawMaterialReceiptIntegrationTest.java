package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.RawMaterial;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.entity.InventoryItemType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import com.cnpm.clothingstore.entity.Supplier;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.repository.InventoryMovementRepository;
import com.cnpm.clothingstore.repository.RawMaterialReceiptRepository;
import com.cnpm.clothingstore.repository.RawMaterialRepository;
import com.cnpm.clothingstore.repository.SupplierRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static com.cnpm.clothingstore.service.AuditTrail.ACTOR_ATTRIBUTE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:rawMaterialReceipt;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class RawMaterialReceiptIntegrationTest {
    private static final String PASSWORD = "WarehouseTest123!";

    @Autowired UserRepository users;
    @Autowired SupplierRepository suppliers;
    @Autowired RawMaterialRepository materials;
    @Autowired RawMaterialReceiptRepository receipts;
    @Autowired InventoryMovementRepository movements;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired RawMaterialReceiptService receiptService;
    @Autowired MockMvc mvc;

    private Long supplierId;
    private Long managerId;
    private String managerToken;

    @BeforeEach
    void setUp() {
        User manager = new User();
        manager.setEmail("warehouse-manager-" + UUID.randomUUID() + "@test.local");
        manager.setFullName("Warehouse manager");
        manager.setPasswordHash(encoder.encode(PASSWORD));
        manager.setRole("MANAGER_WAREHOUSE");
        manager = users.saveAndFlush(manager);
        managerId = manager.getId();
        managerToken = "Bearer " + managerAuth.login(manager.getEmail(), PASSWORD).accessToken();

        Supplier supplier = new Supplier();
        supplier.code = "SUP-" + UUID.randomUUID();
        supplier.name = "Material supplier";
        supplier.active = true;
        supplierId = suppliers.saveAndFlush(supplier).id;
    }

    @Test
    void receivingMaterialPersistsSupplierSnapshotBalanceReceiptAndLedger() throws Exception {
        long materialId = createMaterial("MAT-" + UUID.randomUUID(), "Cotton fabric", "m");
        long receiptCountBefore = receipts.count();
        String response = mvc.perform(post("/api/manager/raw-material-receipts")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(receiptJson(supplierId, materialId, "4.000", "125.50")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.supplierId").value(supplierId))
                .andExpect(jsonPath("$.supplierName").value("Material supplier"))
                .andExpect(jsonPath("$.note").value("test receipt"))
                .andExpect(jsonPath("$.totalCost").value(502.00))
                .andExpect(jsonPath("$.items[0].quantity").value(4.000))
                .andExpect(jsonPath("$.items[0].lineTotal").value(502.00))
                .andReturn().getResponse().getContentAsString();
        long receiptId = ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();

        assertEquals(new BigDecimal("4.000"), materials.findById(materialId).orElseThrow().getAvailableQuantity());
        assertEquals(receiptCountBefore + 1, receipts.count());
        var ledgerRows = movements.findAllByMovementTypeAndReferenceTypeAndReferenceId(
                InventoryMovementType.RAW_MATERIAL_RECEIPT, "RAW_MATERIAL_RECEIPT", receiptId);
        assertEquals(1, ledgerRows.size());
        assertEquals(InventoryItemType.MATERIAL, ledgerRows.getFirst().getItemType());
        assertEquals(materialId, ledgerRows.getFirst().getItemId());
        assertEquals(InventoryLocation.RAW_MATERIAL_AVAILABLE, ledgerRows.getFirst().getLocation());
        assertEquals(new BigDecimal("4.000"), ledgerRows.getFirst().getQuantityDelta());
        assertEquals(new BigDecimal("4.000"), ledgerRows.getFirst().getQuantityAfter());
        assertEquals(managerId, ledgerRows.getFirst().getActorId());
        assertEquals("MANAGER_WAREHOUSE", ledgerRows.getFirst().getActorRole());
        mvc.perform(get("/api/manager/raw-material-receipts/" + receiptId)
                        .header("Authorization", managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].materialCode").value(materials.findById(materialId).orElseThrow().getCode()));
    }

    @Test
    void rejectsDuplicateMaterialLinesWithoutChangingStockOrCreatingReceipt() throws Exception {
        long materialId = createMaterial("MAT-" + UUID.randomUUID(), "Cotton fabric", "m");
        long receiptCountBefore = receipts.count();
        long movementCountBefore = movements.count();
        String body = """
                {"supplierId":%d,"receivedAt":"%s","items":[
                  {"materialId":%d,"quantity":1,"unitCost":10},
                  {"materialId":%d,"quantity":2,"unitCost":10}]}
                """.formatted(supplierId, Instant.now().minusSeconds(60), materialId, materialId);

        mvc.perform(post("/api/manager/raw-material-receipts")
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());

        assertEquals(BigDecimal.ZERO.setScale(3), materials.findById(materialId).orElseThrow().getAvailableQuantity());
        assertEquals(receiptCountBefore, receipts.count());
        assertEquals(movementCountBefore, movements.count());
    }

    @Test
    void rejectsUnknownOrInactiveSupplierAndUnknownOrInactiveMaterial() throws Exception {
        long materialId = createMaterial("MAT-" + UUID.randomUUID(), "Cotton fabric", "m");
        long receiptCountBefore = receipts.count();
        long movementCountBefore = movements.count();
        mvc.perform(post("/api/manager/raw-material-receipts")
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(receiptJson(999999L, materialId, "1.000", "10.00")))
                .andExpect(status().isNotFound());

        Supplier inactiveSupplier = suppliers.findById(supplierId).orElseThrow();
        inactiveSupplier.active = false;
        suppliers.saveAndFlush(inactiveSupplier);
        mvc.perform(post("/api/manager/raw-material-receipts")
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(receiptJson(supplierId, materialId, "1.000", "10.00")))
                .andExpect(status().isNotFound());

        inactiveSupplier.active = true;
        suppliers.saveAndFlush(inactiveSupplier);
        mvc.perform(post("/api/manager/raw-material-receipts")
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(receiptJson(supplierId, 999999L, "1.000", "10.00")))
                .andExpect(status().isNotFound());

        RawMaterial inactiveMaterial = materials.findById(materialId).orElseThrow();
        inactiveMaterial.setActive(false);
        materials.saveAndFlush(inactiveMaterial);
        mvc.perform(post("/api/manager/raw-material-receipts")
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(receiptJson(supplierId, materialId, "1.000", "10.00")))
                .andExpect(status().isNotFound());

        assertEquals(receiptCountBefore, receipts.count());
        assertEquals(movementCountBefore, movements.count());
    }

    @Test
    void rejectsExcessPrecisionAndTotalsThatOverflowMoneyColumn() throws Exception {
        long materialId = createMaterial("MAT-" + UUID.randomUUID(), "Cotton fabric", "m");
        long receiptCountBefore = receipts.count();
        long movementCountBefore = movements.count();
        mvc.perform(post("/api/manager/raw-material-receipts")
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(receiptJson(supplierId, materialId, "1.0001", "10.00")))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/manager/raw-material-receipts")
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(receiptJson(supplierId, materialId, "999999999999.999", "9999999999999.99")))
                .andExpect(status().isBadRequest());

        assertEquals(BigDecimal.ZERO.setScale(3), materials.findById(materialId).orElseThrow().getAvailableQuantity());
        assertEquals(receiptCountBefore, receipts.count());
        assertEquals(movementCountBefore, movements.count());
    }

    @Test
    void concurrentReceiptsSerializeAgainstTheLockedMaterialBalance() throws Exception {
        long materialId = createMaterial("MAT-" + UUID.randomUUID(), "Cotton fabric", "m");
        long receiptCountBefore = receipts.count();
        long movementCountBefore = movements.count();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = executor.submit(() -> receiveConcurrently(materialId, "1.125", ready, start));
            Future<?> second = executor.submit(() -> receiveConcurrently(materialId, "2.250", ready, start));
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            first.get(15, TimeUnit.SECONDS);
            second.get(15, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }

        assertEquals(new BigDecimal("3.375"), materials.findById(materialId).orElseThrow().getAvailableQuantity());
        assertEquals(receiptCountBefore + 2, receipts.count());
        assertEquals(movementCountBefore + 2, movements.count());
    }

    private void receiveConcurrently(long materialId, String quantity, CountDownLatch ready, CountDownLatch start) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(ACTOR_ATTRIBUTE, new AuditTrail.Actor(managerId, "Warehouse manager", "MANAGER_WAREHOUSE"));
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        try {
            ready.countDown();
            if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Timed out waiting for concurrent start");
            receiptService.receive(new RawMaterialReceiptService.CreateRequest(supplierId, Instant.now().minusSeconds(60), null,
                    java.util.List.of(new RawMaterialReceiptService.ItemInput(materialId, new BigDecimal(quantity), new BigDecimal("10.00")))));
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(interrupted);
        } finally {
            RequestContextHolder.resetRequestAttributes();
        }
    }

    private long createMaterial(String code, String name, String unit) throws Exception {
        String response = mvc.perform(post("/api/manager/raw-materials")
                        .header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\",\"name\":\"" + name + "\",\"unit\":\"" + unit + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(response, "$.id")).longValue();
    }

    private static String receiptJson(Long supplierId, long materialId, String quantity, String unitCost) {
        return """
                {"supplierId":%d,"receivedAt":"%s","note":" test receipt ","items":[
                  {"materialId":%d,"quantity":%s,"unitCost":%s}]}
                """.formatted(supplierId, Instant.now().minusSeconds(60), materialId, quantity, unitCost);
    }
}
