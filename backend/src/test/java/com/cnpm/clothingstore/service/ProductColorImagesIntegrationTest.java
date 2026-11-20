package com.cnpm.clothingstore.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cnpm.clothingstore.entity.User;
import com.cnpm.clothingstore.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:productColorImages;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
@Transactional
class ProductColorImagesIntegrationTest {
    private static final String PASSWORD = "TestPassword123!";
    private static final String BLACK_FRONT = "https://cdn.example/black-front.jpg";
    private static final String BLACK_BACK = "https://cdn.example/black-back.jpg";
    private static final String WHITE_FRONT = "https://cdn.example/white-front.jpg";

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired EntityManager entityManager;
    @Autowired ObjectMapper objectMapper;

    @Test
    void createPersistsOrderedImagesAndPublicProductApiReturnsThem() throws Exception {
        MvcResult created = mvc.perform(post("/api/manager/products")
                        .header("Authorization", warehouseToken())
                        .contentType(APPLICATION_JSON)
                        .content(productJson("Đen,Trắng", gallery(BLACK_FRONT, BLACK_BACK, WHITE_FRONT))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode product = objectMapper.readTree(created.getResponse().getContentAsString());
        long productId = product.get("id").asLong();

        entityManager.clear();

        mvc.perform(get("/api/products/" + productId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.colors").value("Đen,Trắng"))
                .andExpect(jsonPath("$.colorImages['Đen'][0]").value(BLACK_FRONT))
                .andExpect(jsonPath("$.colorImages['Đen'][1]").value(BLACK_BACK))
                .andExpect(jsonPath("$.colorImages['Trắng'][0]").value(WHITE_FRONT));
    }

    @Test
    void createRejectsGalleryKeyThatIsNotAProductColor() throws Exception {
        mvc.perform(post("/api/manager/products")
                        .header("Authorization", warehouseToken())
                        .contentType(APPLICATION_JSON)
                        .content(productJson("Đen,Trắng", "{\"Den\":[\"" + BLACK_FRONT + "\"]}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PRODUCT_COLOR_IMAGES"));
    }

    @Test
    void createRejectsImageUrlsThatAreNotHttpsOrSameOriginPaths() throws Exception {
        mvc.perform(post("/api/manager/products")
                        .header("Authorization", warehouseToken())
                        .contentType(APPLICATION_JSON)
                        .content(productJson("Đen", "{\"Đen\":[\"javascript:alert(1)\"]}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PRODUCT_COLOR_IMAGES"));
    }

    @Test
    void createRejectsBlankImageUrl() throws Exception {
        mvc.perform(post("/api/manager/products")
                        .header("Authorization", warehouseToken())
                        .contentType(APPLICATION_JSON)
                        .content(productJson("Đen", "{\"Đen\":[\" \"]}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PRODUCT_COLOR_IMAGES"));
    }

    @Test
    void createRejectsMoreThanSixImagesForOneColor() throws Exception {
        String sevenImages = "{\"Đen\":[\"https://cdn.example/1.jpg\",\"https://cdn.example/2.jpg\","
                + "\"https://cdn.example/3.jpg\",\"https://cdn.example/4.jpg\",\"https://cdn.example/5.jpg\","
                + "\"https://cdn.example/6.jpg\",\"https://cdn.example/7.jpg\"]}";

        mvc.perform(post("/api/manager/products")
                        .header("Authorization", warehouseToken())
                        .contentType(APPLICATION_JSON)
                        .content(productJson("Đen", sevenImages)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PRODUCT_COLOR_IMAGES"));
    }

    @Test
    void updateWithoutColorImagesRetainsExistingGallery() throws Exception {
        MvcResult created = mvc.perform(post("/api/manager/products")
                        .header("Authorization", warehouseToken())
                        .contentType(APPLICATION_JSON)
                        .content(productJson("Đen", "{\"Đen\":[\"" + BLACK_FRONT + "\"]}")))
                .andExpect(status().isOk())
                .andReturn();
        long productId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(put("/api/manager/products/" + productId)
                        .header("Authorization", warehouseToken())
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"name":"Color gallery product","category":"Color gallery","description":"Test product",
                                 "price":100000,"stock":5,"imageUrl":"%s"}
                                """.formatted(BLACK_FRONT)))
                .andExpect(status().isOk());

        entityManager.clear();
        mvc.perform(get("/api/products/" + productId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.colorImages['Đen'][0]").value(BLACK_FRONT));
    }

    private String warehouseToken() {
        User warehouse = new User();
        warehouse.setFullName("Warehouse product image test");
        warehouse.setEmail(UUID.randomUUID() + "@color-images.test");
        warehouse.setPasswordHash(encoder.encode(PASSWORD));
        warehouse.setRole("MANAGER_WAREHOUSE");
        users.saveAndFlush(warehouse);
        return "Bearer " + managerAuth.login(warehouse.getEmail(), PASSWORD).accessToken();
    }

    private static String productJson(String colors, String colorImages) {
        return """
                {"name":"Color gallery product","category":"Color gallery","description":"Test product",
                 "price":100000,"stock":5,"imageUrl":"%s","colors":"%s","colorImages":%s}
                """.formatted(BLACK_FRONT, colors, colorImages);
    }

    private static String gallery(String blackFront, String blackBack, String whiteFront) {
        return "{\"Đen\":[\"" + blackFront + "\",\"" + blackBack + "\"],\"Trắng\":[\"" + whiteFront + "\"]}";
    }
}
