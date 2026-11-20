package com.cnpm.clothingstore.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cnpm.clothingstore.entity.Category;
import com.cnpm.clothingstore.entity.InventoryItemType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import com.cnpm.clothingstore.entity.InventoryMovement;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.entity.Product;
import com.cnpm.clothingstore.entity.RawMaterial;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.repository.CategoryRepository;
import com.cnpm.clothingstore.repository.InventoryMovementRepository;
import com.cnpm.clothingstore.repository.ProductRepository;
import com.cnpm.clothingstore.repository.RawMaterialRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:warehouseReports;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
@Transactional
class WarehouseReportIntegrationTest {
    private static final String PASSWORD = "WarehouseReport123!";
    private static final Instant JANUARY_START = Instant.parse("2025-12-31T17:00:00Z");
    private static final Instant FEBRUARY_START = Instant.parse("2026-01-31T17:00:00Z");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired CategoryRepository categories;
    @Autowired ProductRepository products;
    @Autowired RawMaterialRepository materials;
    @Autowired InventoryMovementRepository movements;
    private String warehouseToken;
    private String salesToken;
    private long productId;
    private long materialId;

    @BeforeEach
    void setUp() {
        warehouseToken = token("MANAGER_WAREHOUSE", "warehouse-report");
        salesToken = token("MANAGER_SALES", "sales-report");
        Category category = new Category();
        category.setName("Warehouse report " + UUID.randomUUID());
        categories.saveAndFlush(category);
        Product product = new Product();
        product.setName("Report product " + UUID.randomUUID());
        product.setCategoryEntity(category);
        product.setPrice(new BigDecimal("100000.00"));
        product.setStock(6);
        products.saveAndFlush(product);
        productId = product.getId();

        RawMaterial material = new RawMaterial();
        material.setCode("RPT-" + UUID.randomUUID().toString().substring(0, 12));
        material.setName("Report material");
        material.setUnit("m");
        materials.saveAndFlush(material);
        materialId = material.getId();
    }

    @Test
    void monthReportUsesVietnamBoundariesReconcilesAndIncludesZeroMovementItems() throws Exception {
        Instant cutover = Instant.parse("2025-12-01T00:00:00Z");
        movement(InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, 5, 5,
                InventoryMovementType.OPENING, "MIGRATION_026_OPENING", cutover);
        movement(InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, 2, 7,
                InventoryMovementType.PRODUCT_RECEIPT, "STOCK_RECEIPT", Instant.parse("2025-12-31T17:00:00Z"));
        movement(InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, -1, 6,
                InventoryMovementType.SALE_RESERVATION, "ORDER_CHECKOUT", Instant.parse("2026-01-31T16:59:59Z"));
        movement(InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, 7, 13,
                InventoryMovementType.PRODUCT_RECEIPT, "STOCK_RECEIPT", FEBRUARY_START);

        String response = mvc.perform(get("/api/manager/warehouse/reports")
                        .header("Authorization", warehouseToken).queryParam("period", "MONTH")
                        .queryParam("year", "2026").queryParam("month", "1"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode report = mapper.readTree(response);
        assertEquals("MONTH", report.path("period").asText());
        assertEquals(JANUARY_START, Instant.parse(report.path("fromInclusive").asText()));
        assertEquals(FEBRUARY_START, Instant.parse(report.path("toExclusive").asText()));
        assertEquals(cutover, Instant.parse(report.path("historyAvailableFrom").asText()));
        assertTrue(report.path("historyComplete").asBoolean());

        JsonNode sellable = balance(report, "PRODUCT", productId, "SELLABLE");
        assertBalance(sellable, "5.000", "2.000", "1.000", "6.000");
        assertBalance(balance(report, "PRODUCT", productId, "FINISHED_WAREHOUSE"),
                "0.000", "0.000", "0.000", "0.000");
        assertBalance(balance(report, "MATERIAL", materialId, "RAW_MATERIAL_AVAILABLE"),
                "0.000", "0.000", "0.000", "0.000");
        assertEquals("1.000", movementTotal(report, "PRODUCT", "SELLABLE", "SALE_RESERVATION", "outgoingQuantity"));
    }

    @Test
    void leapDayMonthAndQuarterAndYearPeriodsUseLocalCalendarBounds() throws Exception {
        Instant cutover = Instant.parse("2024-01-01T00:00:00Z");
        movement(InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, 6, 6,
                InventoryMovementType.OPENING, "MIGRATION_026_OPENING", cutover);
        movement(InventoryItemType.MATERIAL, materialId, InventoryLocation.RAW_MATERIAL_AVAILABLE, 10, 10,
                InventoryMovementType.RAW_MATERIAL_RECEIPT, "RAW_MATERIAL_RECEIPT", Instant.parse("2024-01-31T16:59:59Z"));
        movement(InventoryItemType.MATERIAL, materialId, InventoryLocation.RAW_MATERIAL_AVAILABLE, 3, 13,
                InventoryMovementType.RAW_MATERIAL_RECEIPT, "RAW_MATERIAL_RECEIPT", Instant.parse("2024-02-29T16:59:59Z"));
        movement(InventoryItemType.MATERIAL, materialId, InventoryLocation.RAW_MATERIAL_AVAILABLE, -1, 12,
                InventoryMovementType.MATERIAL_ISSUE, "MATERIAL_ISSUE_REQUEST", Instant.parse("2024-03-01T16:59:59Z"));

        String februaryResponse = mvc.perform(get("/api/manager/warehouse/reports")
                        .header("Authorization", warehouseToken).queryParam("period", "MONTH")
                        .queryParam("year", "2024").queryParam("month", "2"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode february = mapper.readTree(februaryResponse);
        assertEquals(Instant.parse("2024-01-31T17:00:00Z"), Instant.parse(february.path("fromInclusive").asText()));
        assertEquals(Instant.parse("2024-02-29T17:00:00Z"), Instant.parse(february.path("toExclusive").asText()));
        assertBalance(balance(february, "MATERIAL", materialId, "RAW_MATERIAL_AVAILABLE"),
                "10.000", "3.000", "0.000", "13.000");

        JsonNode quarter = report("QUARTER", 2024, null, 1);
        assertEquals(Instant.parse("2023-12-31T17:00:00Z"), Instant.parse(quarter.path("fromInclusive").asText()));
        assertEquals(Instant.parse("2024-03-31T17:00:00Z"), Instant.parse(quarter.path("toExclusive").asText()));
        JsonNode year = report("YEAR", 2024, null, null);
        assertEquals(Instant.parse("2023-12-31T17:00:00Z"), Instant.parse(year.path("fromInclusive").asText()));
        assertEquals(Instant.parse("2024-12-31T17:00:00Z"), Instant.parse(year.path("toExclusive").asText()));
    }

    @Test
    void reportsDisclosePartialCutoverAndRejectPeriodsEntirelyBeforeHistory() throws Exception {
        Instant cutover = Instant.parse("2026-03-10T03:00:00Z");
        movement(InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, 8, 8,
                InventoryMovementType.OPENING, "MIGRATION_026_OPENING", cutover);
        String marchResponse = mvc.perform(get("/api/manager/warehouse/reports")
                        .header("Authorization", warehouseToken).queryParam("period", "MONTH")
                        .queryParam("year", "2026").queryParam("month", "3"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode march = mapper.readTree(marchResponse);
        assertFalse(march.path("historyComplete").asBoolean());
        assertEquals(cutover, Instant.parse(march.path("effectiveFromInclusive").asText()));
        assertEquals(cutover, Instant.parse(march.path("historyAvailableFrom").asText()));
        assertBalance(balance(march, "PRODUCT", productId, "SELLABLE"),
                "0.000", "8.000", "0.000", "8.000");

        mvc.perform(get("/api/manager/warehouse/reports").header("Authorization", warehouseToken)
                        .queryParam("period", "MONTH").queryParam("year", "2026").queryParam("month", "2"))
                .andExpect(status().isConflict());
    }

    @Test
    void validatesPeriodParametersAndRestrictsReportsToWarehouseManagers() throws Exception {
        movement(InventoryItemType.PRODUCT, productId, InventoryLocation.SELLABLE, 6, 6,
                InventoryMovementType.OPENING, "MIGRATION_026_OPENING", Instant.parse("2024-01-01T00:00:00Z"));
        mvc.perform(get("/api/manager/warehouse/reports").header("Authorization", warehouseToken)
                        .queryParam("period", "MONTH").queryParam("year", "2026").queryParam("month", "13"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/manager/warehouse/reports").header("Authorization", warehouseToken)
                        .queryParam("period", "QUARTER").queryParam("year", "2026").queryParam("month", "1"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/manager/warehouse/reports").header("Authorization", warehouseToken)
                        .queryParam("period", "WEEK").queryParam("year", "2026"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/manager/warehouse/reports").header("Authorization", salesToken)
                        .queryParam("period", "YEAR").queryParam("year", "2026"))
                .andExpect(status().isForbidden());
    }

    private JsonNode report(String period, int year, Integer month, Integer quarter) throws Exception {
        var request = get("/api/manager/warehouse/reports").header("Authorization", warehouseToken)
                .queryParam("period", period).queryParam("year", String.valueOf(year));
        if (month != null) request.queryParam("month", String.valueOf(month));
        if (quarter != null) request.queryParam("quarter", String.valueOf(quarter));
        return mapper.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString());
    }

    private String token(String role, String prefix) {
        User user = new User();
        user.setEmail(prefix + "-" + UUID.randomUUID() + "@warehouse.test");
        user.setFullName(prefix);
        user.setPasswordHash(encoder.encode(PASSWORD));
        user.setRole(role);
        users.saveAndFlush(user);
        return "Bearer " + managerAuth.login(user.getEmail(), PASSWORD).accessToken();
    }

    private void movement(InventoryItemType itemType, long itemId, InventoryLocation location,
                          int delta, int balanceAfter, InventoryMovementType type,
                          String referenceType, Instant createdAt) {
        InventoryMovement movement = new InventoryMovement();
        movement.setItemType(itemType);
        movement.setItemId(itemId);
        movement.setLocation(location);
        movement.setQuantityDelta(BigDecimal.valueOf(delta).setScale(3));
        movement.setQuantityAfter(BigDecimal.valueOf(balanceAfter).setScale(3));
        movement.setMovementType(type);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(Math.abs(UUID.randomUUID().getMostSignificantBits()));
        movement.setActorName("Warehouse report test");
        movement.setActorRole("SYSTEM");
        movement.setCreatedAt(createdAt);
        movements.saveAndFlush(movement);
    }

    private static JsonNode balance(JsonNode report, String itemType, long itemId, String location) {
        for (JsonNode line : report.path("balances")) {
            if (itemType.equals(line.path("itemType").asText()) && itemId == line.path("itemId").asLong()
                    && location.equals(line.path("location").asText())) return line;
        }
        throw new AssertionError("Missing balance line: " + itemType + " " + itemId + " " + location);
    }

    private static void assertBalance(JsonNode line, String opening, String incoming, String outgoing, String closing) {
        assertEquals(opening, line.path("openingQuantity").decimalValue().setScale(3).toPlainString());
        assertEquals(incoming, line.path("incomingQuantity").decimalValue().setScale(3).toPlainString());
        assertEquals(outgoing, line.path("outgoingQuantity").decimalValue().setScale(3).toPlainString());
        assertEquals(closing, line.path("closingQuantity").decimalValue().setScale(3).toPlainString());
        assertEquals(0, line.path("openingQuantity").decimalValue()
                .add(line.path("incomingQuantity").decimalValue())
                .subtract(line.path("outgoingQuantity").decimalValue())
                .compareTo(line.path("closingQuantity").decimalValue()));
    }

    private static String movementTotal(JsonNode report, String itemType, String location, String type, String field) {
        for (JsonNode row : report.path("movementTotals")) {
            if (itemType.equals(row.path("itemType").asText()) && location.equals(row.path("location").asText())
                    && type.equals(row.path("movementType").asText())) {
                return row.path(field).decimalValue().setScale(3).toPlainString();
            }
        }
        throw new AssertionError("Missing movement total: " + itemType + " " + location + " " + type);
    }
}
