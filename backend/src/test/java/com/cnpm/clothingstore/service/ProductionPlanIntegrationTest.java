package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.Category;
import com.cnpm.clothingstore.entity.EmployeeProfile;
import com.cnpm.clothingstore.entity.Product;
import com.cnpm.clothingstore.entity.RawMaterial;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.repository.CategoryRepository;
import com.cnpm.clothingstore.repository.EmployeeProfileRepository;
import com.cnpm.clothingstore.repository.ProductRecipeRepository;
import com.cnpm.clothingstore.repository.ProductRecipeItemRepository;
import com.cnpm.clothingstore.repository.ProductRepository;
import com.cnpm.clothingstore.repository.ProductionPlanMaterialRepository;
import com.cnpm.clothingstore.repository.ProductionPlanRepository;
import com.cnpm.clothingstore.repository.RawMaterialRepository;
import com.cnpm.clothingstore.repository.UserRepository;
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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:productionPlans;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class ProductionPlanIntegrationTest {
    private static final String PASSWORD = "WarehouseTest123!";

    @Autowired UserRepository users;
    @Autowired EmployeeProfileRepository profiles;
    @Autowired CategoryRepository categories;
    @Autowired ProductRepository products;
    @Autowired RawMaterialRepository materials;
    @Autowired ProductRecipeRepository recipes;
    @Autowired ProductRecipeItemRepository recipeItems;
    @Autowired ProductionPlanRepository plans;
    @Autowired ProductionPlanMaterialRepository planMaterials;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired MockMvc mvc;

    private Product product;
    private RawMaterial fabric;
    private RawMaterial thread;
    private Long warehouseEmployeeId;
    private Long generalEmployeeId;
    private String managerToken;

    @BeforeEach
    void setUp() {
        User manager = user("MANAGER_WAREHOUSE", "warehouse-manager");
        managerToken = bearer(managerAuth.login(manager.getEmail(), PASSWORD).accessToken());
        Category category = new Category();
        category.setName("Category-" + UUID.randomUUID());
        category = categories.saveAndFlush(category);
        product = new Product();
        product.setName("Production product");
        product.setCategoryEntity(category);
        product.setPrice(new BigDecimal("500000.00"));
        product.setStock(0);
        product = products.saveAndFlush(product);
        fabric = material("FAB-" + UUID.randomUUID().toString().substring(0, 8), "Cotton fabric", "m");
        thread = material("THR-" + UUID.randomUUID().toString().substring(0, 8), "Sewing thread", "roll");
        warehouseEmployeeId = employee("WAREHOUSE", "Nhân viên may");
        generalEmployeeId = employee("GENERAL", "Nhân viên kho");
    }

    @Test
    void recipeUpdatesCreateImmutableVersionsAndRejectDuplicateOrInvalidLines() throws Exception {
        mvc.perform(put(recipeUrl())
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson("0.750", "0.100")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.items.length()").value(2));

        Long oldRecipeId = recipes.findFirstByProduct_IdAndActiveTrue(product.getId()).orElseThrow().getId();
        mvc.perform(put(recipeUrl())
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"materialId\":" + fabric.getId() + ",\"quantityPerProduct\":1.250}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.items.length()").value(1));

        var oldRecipe = recipes.findById(oldRecipeId).orElseThrow();
        assertFalse(oldRecipe.isActive());
        assertEquals(new BigDecimal("0.750"), recipeItems.findByRecipe_IdOrderByIdAsc(oldRecipeId).stream()
                .filter(item -> item.getMaterial().getId().equals(fabric.getId())).findFirst().orElseThrow().getQuantityPerProduct());
        assertEquals(2, recipes.findAllByProduct_IdOrderByVersionAsc(product.getId()).size());

        String duplicateLines = "{\"items\":["
                + "{\"materialId\":" + fabric.getId() + ",\"quantityPerProduct\":1},"
                + "{\"materialId\":" + fabric.getId() + ",\"quantityPerProduct\":2}]}";
        mvc.perform(put(recipeUrl()).header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(duplicateLines))
                .andExpect(status().isBadRequest());
        mvc.perform(put(recipeUrl()).header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"materialId\":" + fabric.getId() + ",\"quantityPerProduct\":0}]}"))
                .andExpect(status().isBadRequest());
        assertEquals(2, recipes.findAllByProduct_IdOrderByVersionAsc(product.getId()).size());
    }

    @Test
    void plansSnapshotRecipeVersionQuantitiesAndEmployeeAssignment() throws Exception {
        putRecipe("0.750", "0.100");
        String created = mvc.perform(post("/api/manager/production-plans")
                        .header("Authorization", managerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(planJson(4, warehouseEmployeeId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recipeVersion").value(1))
                .andExpect(jsonPath("$.targetQuantity").value(4))
                .andExpect(jsonPath("$.assignedEmployeeId").value(warehouseEmployeeId))
                .andExpect(jsonPath("$.materials[0].requiredQuantity").value(3.0))
                .andReturn().getResponse().getContentAsString();
        long planId = ((Number) com.jayway.jsonpath.JsonPath.read(created, "$.id")).longValue();
        var snapshot = planMaterials.findByPlan_IdOrderByIdAsc(planId);
        assertEquals(2, snapshot.size());
        assertEquals(new BigDecimal("3.000"), snapshot.stream()
                .filter(item -> item.getMaterial().getId().equals(fabric.getId())).findFirst().orElseThrow().getRequiredQuantity());
        mvc.perform(get("/api/manager/production-plans").header("Authorization", managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].materials.length()").value(2));

        putRecipe("2.000", "0.500");
        mvc.perform(get("/api/manager/production-plans/" + planId).header("Authorization", managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipeVersion").value(1))
                .andExpect(jsonPath("$.materials[0].requiredQuantity").value(3.0));
        assertEquals(new BigDecimal("0.750"), planMaterials.findByPlan_IdOrderByIdAsc(planId).stream()
                .filter(item -> item.getMaterial().getId().equals(fabric.getId())).findFirst().orElseThrow().getQuantityPerProduct());
    }

    @Test
    void rejectsNonWarehouseEmployeesAndInactiveProductsAndCancelsOnlyWithoutOutstandingAllocation() throws Exception {
        putRecipe("0.500", "0.100");
        mvc.perform(post("/api/manager/production-plans").header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(planJson(2, generalEmployeeId)))
                .andExpect(status().isBadRequest());
        Long lockedEmployeeId = employee("WAREHOUSE", "Nhân viên sản xuất");
        User lockedEmployee = users.findById(lockedEmployeeId).orElseThrow();
        lockedEmployee.setLocked(true);
        users.saveAndFlush(lockedEmployee);
        mvc.perform(post("/api/manager/production-plans").header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(planJson(2, lockedEmployeeId)))
                .andExpect(status().isBadRequest());

        Product inactive = products.findById(product.getId()).orElseThrow();
        inactive.setActive(false);
        products.saveAndFlush(inactive);
        mvc.perform(post("/api/manager/production-plans").header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(planJson(2, warehouseEmployeeId)))
                .andExpect(status().isNotFound());
        inactive.setActive(true);
        products.saveAndFlush(inactive);

        String created = mvc.perform(post("/api/manager/production-plans").header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(planJson(2, warehouseEmployeeId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long planId = ((Number) com.jayway.jsonpath.JsonPath.read(created, "$.id")).longValue();
        var allocatedMaterial = planMaterials.findByPlan_IdOrderByIdAsc(planId).getFirst();
        allocatedMaterial.setAllocatedQuantity(new BigDecimal("0.500"));
        planMaterials.saveAndFlush(allocatedMaterial);
        mvc.perform(patch("/api/manager/production-plans/" + planId + "/cancel")
                        .header("Authorization", managerToken))
                .andExpect(status().isBadRequest());
        allocatedMaterial.setAllocatedQuantity(BigDecimal.ZERO.setScale(3));
        planMaterials.saveAndFlush(allocatedMaterial);
        mvc.perform(patch("/api/manager/production-plans/" + planId + "/cancel")
                        .header("Authorization", managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        mvc.perform(patch("/api/manager/production-plans/" + planId + "/cancel")
                        .header("Authorization", managerToken))
                .andExpect(status().isBadRequest());
    }

    private void putRecipe(String fabricQuantity, String threadQuantity) throws Exception {
        mvc.perform(put(recipeUrl()).header("Authorization", managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(recipeJson(fabricQuantity, threadQuantity)))
                .andExpect(status().isOk());
    }

    private long employee(String workArea, String title) {
        User employee = user("EMPLOYEE", "employee-" + workArea);
        EmployeeProfile profile = new EmployeeProfile();
        profile.setEmployeeId(employee.getId());
        profile.setAccount(employee);
        profile.setEmployeeCode("EMP-" + UUID.randomUUID());
        profile.setJobTitle(title);
        profile.setHireDate(LocalDate.of(2025, 1, 1));
        profile.setWorkArea(workArea);
        profiles.saveAndFlush(profile);
        return employee.getId();
    }

    private User user(String role, String prefix) {
        User user = new User();
        user.setEmail(prefix + "-" + UUID.randomUUID() + "@test.local");
        user.setFullName(prefix);
        user.setPasswordHash(encoder.encode(PASSWORD));
        user.setRole(role);
        return users.saveAndFlush(user);
    }

    private RawMaterial material(String code, String name, String unit) {
        RawMaterial material = new RawMaterial();
        material.setCode(code);
        material.setName(name);
        material.setUnit(unit);
        return materials.saveAndFlush(material);
    }

    private String recipeUrl() { return "/api/manager/products/" + product.getId() + "/recipe"; }

    private String recipeJson(String fabricQuantity, String threadQuantity) {
        return "{\"items\":["
                + "{\"materialId\":" + fabric.getId() + ",\"quantityPerProduct\":" + fabricQuantity + "},"
                + "{\"materialId\":" + thread.getId() + ",\"quantityPerProduct\":" + threadQuantity + "}]}";
    }

    private String planJson(int targetQuantity, Long employeeId) {
        return "{\"productId\":" + product.getId() + ",\"targetQuantity\":" + targetQuantity
                + ",\"assignedEmployeeId\":" + employeeId + ",\"dueDate\":\"2026-12-01\",\"note\":\"Plan test\"}";
    }

    private static String bearer(String token) { return "Bearer " + token; }
}
