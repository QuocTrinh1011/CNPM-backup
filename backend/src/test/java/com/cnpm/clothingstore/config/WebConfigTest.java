package com.cnpm.clothingstore.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.BeanCreationException;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebConfigTest {
    @Test
    void rejectsWildcardOriginAtStartupWhetherAloneOrMixedWithExplicitOrigins() {
        for (String origins : List.of("*", "https://portal.example, *")) {
            var exception = assertThrows(BeanCreationException.class, () -> startContext(origins));

            assertTrue(causeMessages(exception).contains("CORS_ORIGINS"));
            assertTrue(causeMessages(exception).contains("*"));
        }
    }

    @Test
    void trimsWhitespaceAroundConfiguredOrigins() {
        try (var context = startContext("  https://portal.example  ,  https://admin.example ")) {
            assertEquals(
                    List.of("https://portal.example", "https://admin.example"),
                    allowedOrigins(context.getBean(WebConfig.class)));
        }
    }

    @Test
    void acceptsExplicitOrigins() {
        try (var context = startContext("https://portal.example,https://admin.example")) {
            assertEquals(
                    List.of("https://portal.example", "https://admin.example"),
                    allowedOrigins(context.getBean(WebConfig.class)));
        }
    }

    private AnnotationConfigApplicationContext startContext(String corsOrigins) {
        var context = new AnnotationConfigApplicationContext();
        context.getEnvironment().getPropertySources().addFirst(
                new MapPropertySource("test", Map.of("CORS_ORIGINS", corsOrigins)));
        context.register(WebConfig.class);
        context.refresh();
        return context;
    }

    private List<String> allowedOrigins(WebConfig config) {
        var registry = new TestCorsRegistry();
        config.addCorsMappings(registry);
        return registry.configurations().get("/api/**").getAllowedOrigins();
    }

    private String causeMessages(Throwable exception) {
        var messages = new StringBuilder();
        for (var cause = exception; cause != null; cause = cause.getCause()) {
            messages.append(cause.getMessage()).append('\n');
        }
        return messages.toString();
    }

    private static class TestCorsRegistry extends CorsRegistry {
        Map<String, CorsConfiguration> configurations() {
            return getCorsConfigurations();
        }
    }
}
