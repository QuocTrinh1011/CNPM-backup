package com.cnpm.clothingstore.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final String[] origins;

    public WebConfig(@Value("${CORS_ORIGINS:${app.cors.origins:http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:4173}}") String origins) {
        this.origins = Arrays.stream(origins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);

        if (Arrays.asList(this.origins).contains("*")) {
            throw new IllegalStateException("CORS_ORIGINS must list explicit origins; '*' is not allowed because CORS credentials are enabled.");
        }
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
