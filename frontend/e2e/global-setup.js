import bcrypt from 'bcryptjs';
import pg from 'pg';
import { getE2EDatabaseSettings } from './database.js';
import { MANAGER_EMAIL, MANAGER_PASSWORD } from './credentials.js';

const { Pool } = pg;

export default async function globalSetup() {
  const settings = getE2EDatabaseSettings();
  const managerPasswordHash = await bcrypt.hash(MANAGER_PASSWORD, 10);
  const pool = new Pool({ connectionString: settings.connectionString, connectionTimeoutMillis: 2_000 });
  const deadline = Date.now() + 60_000;

  try {
    let schemaReady = false;
    while (Date.now() < deadline) {
      try {
        const result = await pool.query("SELECT to_regclass('public.customers') AS customers");
        if (result.rows[0].customers) {
          schemaReady = true;
          break;
        }
      } catch {
        // Spring may still be creating the schema or PostgreSQL may still be starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    if (!schemaReady) {
      throw new Error('PostgreSQL or the Spring-created crm_e2e schema was not ready within 60 seconds.');
    }

    await pool.query(
      `INSERT INTO customers (email, full_name, password_hash, role, locked, created_at)
       VALUES ($1, $2, $3, 'MANAGER_SALES', FALSE, now())
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role = 'MANAGER_SALES',
         locked = FALSE,
         deleted_at = NULL`,
      [MANAGER_EMAIL, 'E2E Manager', managerPasswordHash],
    );

    const manager = await pool.query(
      'SELECT role, locked, deleted_at, password_hash FROM customers WHERE email = $1',
      [MANAGER_EMAIL],
    );
    const seededManager = manager.rows[0];
    if (
      !seededManager ||
      seededManager.role !== 'MANAGER_SALES' ||
      seededManager.locked ||
      seededManager.deleted_at ||
      !(await bcrypt.compare(MANAGER_PASSWORD, seededManager.password_hash))
    ) {
      throw new Error('Could not seed a usable E2E manager account in crm_e2e.');
    }
  } finally {
    await pool.end();
  }
}
