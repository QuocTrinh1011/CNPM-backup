package com.htttdn.crm.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.EnumSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:adminGuardCoverage;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class AdminAccessGuardCoverageTest {
    @Autowired RequestMappingHandlerMapping mappings;
    @Autowired MockMvc mvc;

    @Test void everyAdminAndManagerMappingRequiresAuthentication() throws Exception {
        int checkedMappings = 0;
        for (var mapping : mappings.getHandlerMethods().keySet()) {
            for (String pattern : mapping.getPatternValues()) {
                if (!isProtectedPortal(pattern) || isPublicAuthPath(pattern)) continue;
                String path = concretePath(pattern);
                Set<RequestMethod> methods = mapping.getMethodsCondition().getMethods();
                if (methods.isEmpty()) methods = EnumSet.of(RequestMethod.GET);
                for (RequestMethod method : methods) {
                    mvc.perform(request(HttpMethod.valueOf(method.name()), path)).andExpect(status().isUnauthorized());
                    checkedMappings++;
                }
            }
        }
        assertTrue(checkedMappings > 0, "Expected to find protected admin or manager mappings");
    }

    private static boolean isProtectedPortal(String path) {
        return path.startsWith("/api/admin/") || path.equals("/api/admin")
                || path.startsWith("/api/manager/") || path.equals("/api/manager");
    }

    private static boolean isPublicAuthPath(String path) {
        return path.startsWith("/api/admin/auth/") || path.startsWith("/api/manager/auth/");
    }

    private static String concretePath(String pattern) {
        return pattern.replaceAll("\\{[^/]+}", "1");
    }
}
