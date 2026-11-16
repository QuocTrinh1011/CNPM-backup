import { describe, expect, it } from 'vitest';
import { getE2EDatabaseSettings } from '../e2e/database.js';

describe('E2E database safety', () => {
  it('converts the dedicated local database URL for PostgreSQL and Spring', () => {
    expect(getE2EDatabaseSettings('postgresql://e2e:e2e@localhost:5433/crm_e2e')).toEqual({
      connectionString: 'postgresql://e2e:e2e@localhost:5433/crm_e2e',
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
});
