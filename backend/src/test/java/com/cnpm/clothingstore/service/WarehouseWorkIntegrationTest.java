package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.Category;
import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.InventoryItemType;
import com.cnpm.clothingstore.entity.InventoryLocation;
import com.cnpm.clothingstore.entity.InventoryMovement;
import com.cnpm.clothingstore.entity.InventoryMovementType;
import com.cnpm.clothingstore.entity.Product;
import com.cnpm.clothingstore.entity.ProductionPlanMaterial;
import com.cnpm.clothingstore.entity.RawMaterial;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.repository.CategoryRepository;
import com.cnpm.clothingstore.repository.EmployeeProfileRepository;
import com.cnpm.clothingstore.repository.InventoryMovementRepository;
import com.cnpm.clothingstore.repository.ProductRepository;
import com.cnpm.clothingstore.repository.ProductionPlanMaterialRepository;
import com.cnpm.clothingstore.repository.ProductionPlanRepository;
import com.cnpm.clothingstore.repository.ProductionRunRepository;
import com.cnpm.clothingstore.repository.RawMaterialRepository;
import com.cnpm.clothingstore.repository.UserRepository;
import com.cnpm.clothingstore.repository.WarehouseFinishedStockRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
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
        "spring.datasource.url=jdbc:h2:mem:warehouseWork;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class WarehouseWorkIntegrationTest {
    private static final String PASSWORD = "WarehouseTest123!";

    @Autowired UserRepository users;
    @Autowired EmployeeProfileRepository profiles;
    @Autowired CategoryRepository categories;
    @Autowired ProductRepository products;
    @Autowired RawMaterialRepository materials;
    @Autowired ProductionPlanMaterialRepository planMaterials;
    @Autowired ProductionPlanRepository plans;
    @Autowired ProductionRunRepository runs;
    @Autowired InventoryMovementRepository movements;
    @Autowired WarehouseFinishedStockRepository finishedStocks;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired MockMvc mvc;

    private Product product;
    private RawMaterial fabric;
    private RawMaterial thread;
    private Long warehouseEmployeeId;
    private Long otherWarehouseEmployeeId;
    private Long generalEmployeeId;
    private String warehouseManagerToken;
    private String hrManagerToken;
    private String employeeToken;
    private String otherEmployeeToken;
    private String generalEmployeeToken;

    @BeforeEach
    void setUp() {
        warehouseManagerToken = login(user("MANAGER_WAREHOUSE", "warehouse-manager"));
        hrManagerToken = login(user("MANAGER_HR", "hr-manager"));
        User employee = employee("WAREHOUSE", "warehouse-worker");
        warehouseEmployeeId = employee.getId();
        employeeToken = login(employee);
        User other = employee("WAREHOUSE", "warehouse-worker-other");
        otherWarehouseEmployeeId = other.getId();
        otherEmployeeToken = login(other);
        User general = employee("GENERAL", "general-worker");
        generalEmployeeId = general.getId();
        generalEmployeeToken = login(general);

        Category category = new Category();
        category.setName("Warehouse work " + UUID.randomUUID());
        category = categories.saveAndFlush(category);
        product = new Product();
        product.setName("Warehouse work product");
        product.setCategoryEntity(category);
        product.setPrice(new BigDecimal("300000.00"));
        product.setStock(0);
        product = products.saveAndFlush(product);

        fabric = material("FAB-" + shortId(), "Cotton fabric", "m", "10.000");
        thread = material("THR-" + shortId(), "Sewing thread", "roll", "3.000");
        postRecipeAndCreatePlan(4, warehouseEmployeeId, "0.750", "0.100");
    }

    @Test
    void employeesCanRequestOnlyTheirAssignedPlanAndWarehouseManagerCanApproveOrRejectOnce() throws Exception {
        List<ProductionPlanMaterial> lines = planLines();
        long fabricLine = lineFor(fabric, lines).getId();
        long threadLine = lineFor(thread, lines).getId();

        mvc.perform(get("/api/manager/warehouse/me/plans").header("Authorization", employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].assignedEmployeeId").value(warehouseEmployeeId));
        mvc.perform(get("/api/manager/warehouse/me/plans").header("Authorization", otherEmployeeToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        mvc.perform(post("/api/manager/warehouse/me/material-requests").header("Authorization", otherEmployeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson(planId(), fabricLine, "1.000")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/manager/warehouse/me/plans").header("Authorization", generalEmployeeToken))
                .andExpect(status().isForbidden());

        String rejected = mvc.perform(post("/api/manager/warehouse/me/material-requests")
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson(planId(), fabricLine, "1.000")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.employeeId").value(warehouseEmployeeId))
                .andReturn().getResponse().getContentAsString();
        long rejectedId = jsonLong(rejected, "$.id");
        mvc.perform(get("/api/manager/warehouse/material-requests").header("Authorization", warehouseManagerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(rejectedId));
        mvc.perform(get("/api/manager/warehouse/material-requests").header("Authorization", hrManagerToken))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/manager/warehouse/material-requests/{id}/decision", rejectedId)
                        .header("Authorization", hrManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("APPROVE")))
                .andExpect(status().isForbidden());

        mvc.perform(patch("/api/manager/warehouse/material-requests/{id}/decision", rejectedId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("REJECT")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
        assertEquals(new BigDecimal("10.000"), currentMaterial(fabric).getAvailableQuantity());
        mvc.perform(patch("/api/manager/warehouse/material-requests/{id}/decision", rejectedId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("APPROVE")))
                .andExpect(status().isBadRequest());

        String pending = mvc.perform(post("/api/manager/warehouse/me/material-requests")
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson(planId(), fabricLine, "0.500")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long pendingId = jsonLong(pending, "$.id");
        mvc.perform(patch("/api/manager/production-plans/{id}/cancel", planId())
                        .header("Authorization", warehouseManagerToken))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/manager/warehouse/material-requests/{id}/decision", pendingId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("REJECT")))
                .andExpect(status().isOk());

        String approved = mvc.perform(post("/api/manager/warehouse/me/material-requests")
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planId\":" + planId() + ",\"items\":["
                                + "{\"planMaterialId\":" + fabricLine + ",\"quantity\":3.000},"
                                + "{\"planMaterialId\":" + threadLine + ",\"quantity\":0.400}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long approvedId = jsonLong(approved, "$.id");
        mvc.perform(patch("/api/manager/warehouse/material-requests/{id}/decision", approvedId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("APPROVE")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        assertEquals(new BigDecimal("7.000"), currentMaterial(fabric).getAvailableQuantity());
        assertEquals(new BigDecimal("2.600"), currentMaterial(thread).getAvailableQuantity());
        assertEquals(new BigDecimal("3.000"), lineFor(fabric, planLines()).getAllocatedQuantity());
        assertEquals(new BigDecimal("0.400"), lineFor(thread, planLines()).getAllocatedQuantity());
        assertMovementLedger(fabric, "7.000");
        assertMovementLedger(thread, "2.600");
        assertMovementBalance(InventoryItemType.MATERIAL, fabric.getId(), InventoryLocation.PRODUCTION_ALLOCATED,
                planId(), "3.000");
        assertMovementBalance(InventoryItemType.MATERIAL, thread.getId(), InventoryLocation.PRODUCTION_ALLOCATED,
                planId(), "0.400");
    }

    @Test
    void requestRejectsQuantityAboveRemainingRecipeNeedAndApprovalIsAtomicWhenMaterialIsInsufficient() throws Exception {
        List<ProductionPlanMaterial> lines = planLines();
        long fabricLine = lineFor(fabric, lines).getId();
        long threadLine = lineFor(thread, lines).getId();

        mvc.perform(post("/api/manager/warehouse/me/material-requests").header("Authorization", employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson(planId(), fabricLine, "3.001")))
                .andExpect(status().isBadRequest());

        String firstPending = mvc.perform(post("/api/manager/warehouse/me/material-requests")
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson(planId(), fabricLine, "2.000")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long firstPendingId = jsonLong(firstPending, "$.id");
        mvc.perform(post("/api/manager/warehouse/me/material-requests").header("Authorization", employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson(planId(), fabricLine, "2.000")))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/manager/warehouse/material-requests/{id}/decision", firstPendingId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("REJECT")))
                .andExpect(status().isOk());

        RawMaterial lowStockThread = currentMaterial(thread);
        lowStockThread.setAvailableQuantity(new BigDecimal("0.100"));
        materials.saveAndFlush(lowStockThread);
        String request = mvc.perform(post("/api/manager/warehouse/me/material-requests")
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planId\":" + planId() + ",\"items\":["
                                + "{\"planMaterialId\":" + fabricLine + ",\"quantity\":1.000},"
                                + "{\"planMaterialId\":" + threadLine + ",\"quantity\":0.400}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long requestId = jsonLong(request, "$.id");

        mvc.perform(patch("/api/manager/warehouse/material-requests/{id}/decision", requestId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("APPROVE")))
                .andExpect(status().isBadRequest());
        assertEquals(new BigDecimal("10.000"), currentMaterial(fabric).getAvailableQuantity());
        assertEquals(new BigDecimal("0.100"), currentMaterial(thread).getAvailableQuantity());
        assertEquals(BigDecimal.ZERO.setScale(3), lineFor(fabric, planLines()).getAllocatedQuantity());
        mvc.perform(get("/api/manager/warehouse/me/material-requests").header("Authorization", employeeToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].status").value("PENDING"));
    }

    @Test
    void productionConsumesExactRecipeSnapshotAndRejectsOutputBeyondTargetOrUnallocatedMaterials() throws Exception {
        List<ProductionPlanMaterial> lines = planLines();
        requestAndApprove(List.of(
                new RequestLine(lineFor(fabric, lines).getId(), "3.000"),
                new RequestLine(lineFor(thread, lines).getId(), "0.400")));

        mvc.perform(post("/api/manager/warehouse/me/plans/{id}/production-runs", planId())
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"producedQuantity\":2,\"note\":\"May 2 san pham\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.producedQuantity").value(2))
                .andExpect(jsonPath("$.consumptions[0].quantity").value(1.5));
        assertEquals(2, plans.findById(planId()).orElseThrow().getCompletedQuantity());
        assertEquals(new BigDecimal("1.500"), lineFor(fabric, planLines()).getConsumedQuantity());
        assertEquals(new BigDecimal("0.200"), lineFor(thread, planLines()).getConsumedQuantity());
        mvc.perform(post("/api/manager/warehouse/me/plans/{id}/production-runs", planId())
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"producedQuantity\":3}"))
                .andExpect(status().isBadRequest());
        assertEquals(2, plans.findById(planId()).orElseThrow().getCompletedQuantity());
        mvc.perform(post("/api/manager/warehouse/me/plans/{id}/production-runs", planId())
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"producedQuantity\":2}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/manager/production-plans/{id}", planId()).header("Authorization", warehouseManagerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        assertEquals(4, finishedStocks.findById(product.getId()).orElseThrow().getQuantity());
        assertMovementBalance(InventoryItemType.PRODUCT, product.getId(), InventoryLocation.FINISHED_WAREHOUSE,
                null, "4.000");
        assertMovementBalance(InventoryItemType.MATERIAL, fabric.getId(), InventoryLocation.PRODUCTION_ALLOCATED,
                planId(), "0.000");
        assertMovementBalance(InventoryItemType.MATERIAL, thread.getId(), InventoryLocation.PRODUCTION_ALLOCATED,
                planId(), "0.000");

        Long secondEmployeeId = employee("WAREHOUSE", "worker-with-small-allocation").getId();
        long shortPlanId = createPlan(1, secondEmployeeId);
        List<ProductionPlanMaterial> shortLines = planMaterials.findByPlan_IdOrderByIdAsc(shortPlanId);
        requestAndApprove(shortPlanId, secondEmployeeId, List.of(new RequestLine(
                lineFor(fabric, shortLines).getId(), "0.500")));
        long runsBeforeShortage = runs.count();
        mvc.perform(post("/api/manager/warehouse/me/plans/{id}/production-runs", shortPlanId)
                        .header("Authorization", login(userById(secondEmployeeId)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"producedQuantity\":1}"))
                .andExpect(status().isBadRequest());
        assertEquals(0, plans.findById(shortPlanId).orElseThrow().getCompletedQuantity());
        assertEquals(runsBeforeShortage, runs.count());
    }

    @Test
    void materialReturnIsBoundedByUnusedAllocationAndAllowsPlanCancellationAfterApproval() throws Exception {
        List<ProductionPlanMaterial> lines = planLines();
        requestAndApprove(List.of(
                new RequestLine(lineFor(fabric, lines).getId(), "3.000"),
                new RequestLine(lineFor(thread, lines).getId(), "0.400")));
        mvc.perform(post("/api/manager/warehouse/me/plans/{id}/production-runs", planId())
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"producedQuantity\":1}"))
                .andExpect(status().isCreated());

        List<ProductionPlanMaterial> afterProduction = planLines();
        long fabricLine = lineFor(fabric, afterProduction).getId();
        long threadLine = lineFor(thread, afterProduction).getId();
        mvc.perform(post("/api/manager/warehouse/me/plans/{id}/material-returns", planId())
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"planMaterialId\":" + fabricLine + ",\"quantity\":2.251}]}"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/manager/warehouse/me/plans/{id}/material-returns", planId())
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"planMaterialId\":" + fabricLine + ",\"quantity\":0.500}]}"))
                .andExpect(status().isCreated());
        String employeeReturns = mvc.perform(get("/api/manager/warehouse/me/material-returns")
                        .header("Authorization", employeeToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        long rejectedReturnId = jsonLong(employeeReturns, "$.content[0].id");
        mvc.perform(patch("/api/manager/warehouse/material-returns/{id}/decision", rejectedReturnId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("REJECT")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
        assertEquals(new BigDecimal("7.000"), currentMaterial(fabric).getAvailableQuantity());
        assertEquals(new BigDecimal("2.600"), currentMaterial(thread).getAvailableQuantity());

        String requested = mvc.perform(post("/api/manager/warehouse/me/plans/{id}/material-returns", planId())
                        .header("Authorization", employeeToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":["
                                + "{\"planMaterialId\":" + fabricLine + ",\"quantity\":2.250},"
                                + "{\"planMaterialId\":" + threadLine + ",\"quantity\":0.300}]}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        long returnId = jsonLong(requested, "$.id");
        mvc.perform(patch("/api/manager/warehouse/material-returns/{id}/decision", returnId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("APPROVE")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        assertEquals(new BigDecimal("9.250"), currentMaterial(fabric).getAvailableQuantity());
        assertEquals(new BigDecimal("2.900"), currentMaterial(thread).getAvailableQuantity());
        assertEquals(new BigDecimal("2.250"), lineFor(fabric, planLines()).getReturnedQuantity());
        assertEquals(new BigDecimal("0.300"), lineFor(thread, planLines()).getReturnedQuantity());
        assertMovementBalance(InventoryItemType.MATERIAL, fabric.getId(), InventoryLocation.PRODUCTION_ALLOCATED,
                planId(), "0.000");
        assertMovementBalance(InventoryItemType.MATERIAL, thread.getId(), InventoryLocation.PRODUCTION_ALLOCATED,
                planId(), "0.000");
        mvc.perform(patch("/api/manager/production-plans/{id}/cancel", planId())
                        .header("Authorization", warehouseManagerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        assertMovementLedger(fabric, "9.250");
        assertMovementLedger(thread, "2.900");
    }

    private void requestAndApprove(List<RequestLine> lines) throws Exception {
        requestAndApprove(planId(), warehouseEmployeeId, lines);
    }

    private void requestAndApprove(long plan, long employee, List<RequestLine> lines) throws Exception {
        String body = "{\"planId\":" + plan + ",\"items\":[" + lines.stream()
                .map(line -> "{\"planMaterialId\":" + line.planMaterialId() + ",\"quantity\":" + line.quantity() + "}")
                .collect(java.util.stream.Collectors.joining(",")) + "]}";
        String response = mvc.perform(post("/api/manager/warehouse/me/material-requests")
                        .header("Authorization", employee == warehouseEmployeeId ? employeeToken : login(userById(employee)))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long requestId = jsonLong(response, "$.id");
        mvc.perform(patch("/api/manager/warehouse/material-requests/{id}/decision", requestId)
                        .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(decisionJson("APPROVE")))
                .andExpect(status().isOk());
    }

    private long createPlan(int target, Long employeeId) throws Exception {
        String response = mvc.perform(post("/api/manager/production-plans").header("Authorization", warehouseManagerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(planJson(target, employeeId)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return jsonLong(response, "$.id");
    }

    private void postRecipeAndCreatePlan(int target, Long employeeId, String fabricQuantity, String threadQuantity) {
        try {
            mvc.perform(put("/api/manager/products/{id}/recipe", product.getId())
                            .header("Authorization", warehouseManagerToken).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"items\":["
                                    + "{\"materialId\":" + fabric.getId() + ",\"quantityPerProduct\":" + fabricQuantity + "},"
                                    + "{\"materialId\":" + thread.getId() + ",\"quantityPerProduct\":" + threadQuantity + "}]}"))
                    .andExpect(status().isOk());
            createPlan(target, employeeId);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private List<ProductionPlanMaterial> planLines() {
        return planMaterials.findByPlan_IdOrderByIdAsc(planId());
    }

    private long planId() {
        return plans.findAll().stream().filter(plan -> plan.getProduct().getId().equals(product.getId()))
                .max(Comparator.comparingLong(plan -> plan.getId())).orElseThrow().getId();
    }

    private static ProductionPlanMaterial lineFor(RawMaterial material, List<ProductionPlanMaterial> lines) {
        return lines.stream().filter(line -> line.getMaterial().getId().equals(material.getId())).findFirst().orElseThrow();
    }

    private RawMaterial currentMaterial(RawMaterial material) {
        return materials.findById(material.getId()).orElseThrow();
    }

    private void assertMovementLedger(RawMaterial material, String expected) {
        assertMovementBalance(InventoryItemType.MATERIAL, material.getId(),
                InventoryLocation.RAW_MATERIAL_AVAILABLE, null, expected);
        assertEquals(new BigDecimal(expected), currentMaterial(material).getAvailableQuantity());
    }

    private void assertMovementBalance(InventoryItemType itemType, Long itemId, InventoryLocation location,
                                      Long scopeId, String expected) {
        BigDecimal total = movements.findAllByItemTypeAndItemIdAndLocationAndScopeIdOrderByIdAsc(
                        itemType, itemId, location, scopeId)
                .stream().map(InventoryMovement::getQuantityDelta).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(new BigDecimal(expected), total.setScale(3));
    }

    private RawMaterial material(String code, String name, String unit, String opening) {
        RawMaterial material = new RawMaterial();
        material.setCode(code);
        material.setName(name);
        material.setUnit(unit);
        material.setAvailableQuantity(new BigDecimal(opening));
        material = materials.saveAndFlush(material);
        InventoryMovement movement = new InventoryMovement();
        movement.setItemType(InventoryItemType.MATERIAL);
        movement.setItemId(material.getId());
        movement.setLocation(InventoryLocation.RAW_MATERIAL_AVAILABLE);
        movement.setQuantityDelta(new BigDecimal(opening));
        movement.setQuantityAfter(new BigDecimal(opening));
        movement.setMovementType(InventoryMovementType.OPENING);
        movement.setReferenceType("TEST_OPENING");
        movement.setReferenceId(material.getId());
        movement.setActorId(1L);
        movement.setActorName("Warehouse fixture");
        movement.setActorRole("TEST");
        movements.saveAndFlush(movement);
        return material;
    }

    private User employee(String workArea, String name) {
        User user = user("EMPLOYEE", name);
        EmployeeProfile profile = new EmployeeProfile();
        profile.setEmployeeId(user.getId());
        profile.setAccount(user);
        profile.setEmployeeCode("EMP-" + UUID.randomUUID());
        profile.setJobTitle("Warehouse employee");
        profile.setHireDate(LocalDate.of(2025, 1, 1));
        profile.setWorkArea(workArea);
        profiles.saveAndFlush(profile);
        return user;
    }

    private User userById(Long id) { return users.findById(id).orElseThrow(); }

    private User user(String role, String prefix) {
        User user = new User();
        user.setEmail(prefix + "-" + UUID.randomUUID() + "@test.local");
        user.setFullName(prefix);
        user.setPasswordHash(encoder.encode(PASSWORD));
        user.setRole(role);
        return users.saveAndFlush(user);
    }

    private String login(User user) { return "Bearer " + managerAuth.login(user.getEmail(), PASSWORD).accessToken(); }
    private static String shortId() { return UUID.randomUUID().toString().substring(0, 8); }
    private String planJson(int target, Long employee) {
        return "{\"productId\":" + product.getId() + ",\"targetQuantity\":" + target
                + ",\"assignedEmployeeId\":" + employee + ",\"dueDate\":\"2026-12-01\"}";
    }
    private static String requestJson(long planId, long materialLineId, String quantity) {
        return "{\"planId\":" + planId + ",\"items\":[{\"planMaterialId\":" + materialLineId
                + ",\"quantity\":" + quantity + "}]}";
    }
    private static String decisionJson(String decision) { return "{\"decision\":\"" + decision + "\"}"; }
    private static long jsonLong(String json, String expression) {
        return ((Number) com.jayway.jsonpath.JsonPath.read(json, expression)).longValue();
    }
    private record RequestLine(long planMaterialId, String quantity) {}
}
