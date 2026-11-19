const backendEnvironmentKeys = new Set([
  'path',
  'systemroot',
  'windir',
  'temp',
  'tmp',
  'tmpdir',
  'home',
  'userprofile',
  'java_home',
  'maven_home',
  'm2_home',
  'lang',
  'lc_all',
]);

export function getE2EDatabaseSettings(rawUrl = process.env.E2E_DATABASE_URL) {
  if (!rawUrl) {
    throw new Error('Set E2E_DATABASE_URL to a disposable PostgreSQL database named crm_e2e.');
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    throw new Error('E2E_DATABASE_URL must be a valid postgresql:// connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('E2E_DATABASE_URL must use the postgresql:// protocol.');
  }
  if (databaseUrl.pathname !== '/crm_e2e') {
    throw new Error('Refusing to run E2E against a database other than crm_e2e.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) {
    throw new Error('E2E_DATABASE_URL must point to a local loopback PostgreSQL server.');
  }
  if (!databaseUrl.hostname || !databaseUrl.username || !databaseUrl.password) {
    throw new Error('E2E_DATABASE_URL must include a host, username, and password.');
  }
  if (databaseUrl.search || databaseUrl.hash) {
    throw new Error('E2E_DATABASE_URL must not include query or fragment options.');
  }

  const host = databaseUrl.hostname.replace(/^\[|\]$/g, '');
  const username = decodeURIComponent(databaseUrl.username);
  const password = decodeURIComponent(databaseUrl.password);

  return {
    pgConfig: {
      host,
      port: Number(databaseUrl.port || 5432),
      database: 'crm_e2e',
      user: username,
      password,
    },
    jdbcUrl: `jdbc:postgresql://${databaseUrl.host}/crm_e2e`,
    username,
    password,
  };
}

export function createE2EBackendEnvironment(sourceEnv, database) {
  const inheritedSafeEnvironment = Object.fromEntries(
    Object.entries(sourceEnv).filter(([name]) => backendEnvironmentKeys.has(name.toLowerCase())),
  );

  return {
    ...inheritedSafeEnvironment,
    DB_URL: database.jdbcUrl,
    DB_USERNAME: database.username,
    DB_PASSWORD: database.password,
    JWT_SECRET: 'playwright-e2e-only-secret-at-least-32-bytes',
    SERVER_PORT: '8082',
    SERVER_ADDRESS: '127.0.0.1',
    SPRING_DATASOURCE_URL: database.jdbcUrl,
    SPRING_DATASOURCE_USERNAME: database.username,
    SPRING_DATASOURCE_PASSWORD: database.password,
    SPRING_JPA_HIBERNATE_DDL_AUTO: 'create-drop',
    SPRING_APPLICATION_NAME: 'crm-playwright-e2e',
    CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174,http://localhost:5175',
    SECURE_REFRESH_COOKIE: 'false',
    APP_RATE_LIMIT_ENABLED: 'false',
  };
}
