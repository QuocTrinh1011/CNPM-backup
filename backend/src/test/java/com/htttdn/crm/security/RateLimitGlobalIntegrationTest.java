package com.htttdn.crm.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:rateGlobalTests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "app.rate-limit.per-minute=3"
    })
@AutoConfigureMockMvc
@Transactional
class RateLimitGlobalIntegrationTest {
  @Autowired MockMvc mvc;

  static RequestPostProcessor from(String ip) {
    return request -> {
      request.setRemoteAddr(ip);
      return request;
    };
  }

  @Test
  void globalBucketReturns429AfterPerMinuteLimit() throws Exception {
    for (int i = 0; i < 3; i++) {
      mvc.perform(get("/api/products").with(from("10.0.10.1"))).andExpect(status().isOk());
    }
    mvc.perform(get("/api/products").with(from("10.0.10.1")))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists("Retry-After"))
        .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    mvc.perform(get("/api/products").with(from("10.0.10.2"))).andExpect(status().isOk());
  }
}
