import { describe, expect, it } from 'vitest';
import { createE2EBackendEnvironment, getE2EDatabaseSettings } from '../e2e/database.js';

describe('E2E database safety', () => {
  it('converts the dedicated local database URL for PostgreSQL and Spring', () => {
    expect(getE2EDatabaseSettings('postgresql://e2e:e2e@localhost:5433/crm_e2e')).toEqual({
      pgConfig: {
        host: 'localhost',
        port: 5433,
        database: 'crm_e2e',
        user: 'e2e',
        password: 'e2e',
      },
      jdbcUrl: 'jdbc:postgresql://localhost:5433/crm_e2e',
      username: 'e2e',
      password: 'e2e',
    });
  });

  it('refuses a database name that could contain application data', () => {
    expect(() => getE2EDatabaseSettings('postgresql://e2e:e2e@localhost:5433/htttdn'))
      .toThrow('Refusing to run E2E against a database other than crm_e2e.');
  });

  it('refuses a PostgreSQL server outside the local machine', () => {
    expect(() => getE2EDatabaseSettings('postgresql://e2e:e2e@db.example.com:5432/crm_e2e'))
      .toThrow('E2E_DATABASE_URL must point to a local loopback PostgreSQL server.');
  });

  it('refuses URL options that could redirect a PostgreSQL client to another host', () => {
    expect(() => getE2EDatabaseSettings('postgresql://e2e:e2e@localhost:5433/crm_e2e?host=db.example.com'))
      .toThrow('E2E_DATABASE_URL must not include query or fragment options.');
  });

  it('pins Spring datasource settings and drops inherited Spring or JVM overrides', () => {
    const database = getE2EDatabaseSettings('postgresql://e2e:e2e@localhost:5433/crm_e2e');
    const env = createE2EBackendEnvironment({
      PATH: 'maven-and-java-path',
      SPRING_DATASOURCE_URL: 'jdbc:postgresql://remote.example.com/production',
      SPRING_APPLICATION_JSON: '{"spring":{"datasource":{"url":"jdbc:postgresql://other.example.com/db"}}}',
      JAVA_TOOL_OPTIONS: '-Dspring.datasource.url=jdbc:postgresql://another.example.com/db',
      MAVEN_OPTS: '-Dspring.datasource.url=jdbc:postgresql://maven.example.com/db',
    }, database);

    expect(env.PATH).toBe('maven-and-java-path');
    expect(env.DB_URL).toBe('jdbc:postgresql://localhost:5433/crm_e2e');
    expect(env.SPRING_DATASOURCE_URL).toBe('jdbc:postgresql://localhost:5433/crm_e2e');
    expect(env.SPRING_DATASOURCE_USERNAME).toBe('e2e');
    expect(env.SPRING_DATASOURCE_PASSWORD).toBe('e2e');
    expect(env.SPRING_JPA_HIBERNATE_DDL_AUTO).toBe('create-drop');
    expect(env.SPRING_APPLICATION_JSON).toBeUndefined();
    expect(env.JAVA_TOOL_OPTIONS).toBeUndefined();
    expect(env.MAVEN_OPTS).toBeUndefined();
  });
});
