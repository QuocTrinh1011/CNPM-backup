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

  return {
    connectionString: rawUrl,
    jdbcUrl: `jdbc:postgresql://${databaseUrl.host}${databaseUrl.pathname}${databaseUrl.search}`,
    username: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
  };
}
