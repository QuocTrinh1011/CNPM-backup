package com.htttdn.crm.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:apiValidationTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop"
    })
@AutoConfigureMockMvc
@Transactional
class ApiPayloadValidationIntegrationTest {
  @Autowired MockMvc mvc;

  static RequestPostProcessor from(String ip) {
    return request -> {
      request.setRemoteAddr(ip);
      return request;
    };
  }

  @Test
  void malformedJsonReturns400() throws Exception {
    mvc.perform(
            post("/api/auth/register")
                .with(from("10.0.20.1"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{not-json"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_JSON"));
  }

  @Test
  void emptyBodyReturns400() throws Exception {
    mvc.perform(
            post("/api/auth/login").with(from("10.0.20.2")).contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_JSON"));
  }

  @Test
  void wrongParamTypeReturns400() throws Exception {
    mvc.perform(get("/api/products/not-a-number").with(from("10.0.20.3")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  void oversizedPayloadReturns413() throws Exception {
    String huge = "{\"email\":\"" + "a".repeat(1_100_000) + "@example.com\",\"password\":\"x\"}";
    mvc.perform(
            post("/api/auth/login")
                .with(from("10.0.20.4"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(huge))
        .andExpect(status().isPayloadTooLarge())
        .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
  }

  @Test
  void validSizePayloadStillAccepted() throws Exception {
    mvc.perform(
            post("/api/auth/login")
                .with(from("10.0.20.5"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"nobody@example.com\",\"password\":\"WrongPass1\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void unknownApiRouteReturnsJson404() throws Exception {
    mvc.perform(get("/api/definitely-not-a-route").with(from("10.0.20.6")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void unsupportedMethodReturns405() throws Exception {
    mvc.perform(delete("/api/products").with(from("10.0.20.7")))
        .andExpect(status().isMethodNotAllowed())
        .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
  }

  @Test
  void fieldValidationReturnsDetails() throws Exception {
    String body =
        "{\"email\":\"bad\",\"password\":\"short\",\"fullName\":\"\",\"phone\":null,\"age\":5}";
    mvc.perform(
            post("/api/auth/register")
                .with(from("10.0.20.8"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.fields").exists());
  }
}
