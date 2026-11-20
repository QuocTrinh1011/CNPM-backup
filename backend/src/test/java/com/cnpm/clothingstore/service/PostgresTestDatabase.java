package com.cnpm.clothingstore.service;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

import java.nio.file.Path;
import java.util.List;

/** Starts an isolated PostgreSQL database for tests that verify PostgreSQL-specific behavior. */
abstract class PostgresTestDatabase {
    private static final PostgreSQLContainer POSTGRES = startPostgres();

    @DynamicPropertySource
    static void registerPostgresProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    private static PostgreSQLContainer startPostgres() {
        Path schema = findSchemaFile();
        PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine")
                .withDatabaseName("crm_test")
                .withUsername("crm_test")
                .withPassword("crm_test")
                .withCopyFileToContainer(MountableFile.forHostPath(schema), "/docker-entrypoint-initdb.d/001-schema.sql");
        postgres.start();
        return postgres;
    }

    private static Path findSchemaFile() {
        Path workingDirectory = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        return List.of(workingDirectory.resolve("../database/schema.sql"), workingDirectory.resolve("database/schema.sql"))
                .stream()
                .map(Path::normalize)
                .filter(path -> path.toFile().isFile())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Cannot find database/schema.sql from " + workingDirectory));
    }
}
