// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPackage } from '@electron/asar';
import { scanDesktopPackage } from './verify-desktop-package.mjs';

let root;
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = null;
});

async function makeOutput() {
  root = await mkdtemp(path.join(tmpdir(), 'desktop-package-check-'));
  const out = path.join(root, 'out');
  await mkdir(out);
  return out;
}

describe('desktop package scanner', () => {
  it('rejects .env files in the generated output', async () => {
    const out = await makeOutput();
    await mkdir(path.join(out, 'resources', 'app'), { recursive: true });
    await writeFile(path.join(out, 'resources', 'app', '.env'), 'VITE_API_KEY=fake-value');

    const result = await scanDesktopPackage(out);

    expect(result.ok).toBe(false);
    expect(result.violations.some(item => item.includes('.env'))).toBe(true);
  });

  it.each(['backend/application.yml', 'database/schema.sql'])(
    'rejects a packaged %s payload', async relativePath => {
      const out = await makeOutput();
      const filePath = path.join(out, 'resources', 'app', relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, 'packaged payload');

      const result = await scanDesktopPackage(out);

      expect(result.ok).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    },
  );

  it('rejects credential-like assignments without printing their value', async () => {
    const out = await makeOutput();
    const appDir = path.join(out, 'resources', 'app');
    await mkdir(appDir, { recursive: true });
    await writeFile(path.join(appDir, 'config.js'), "const apiSecret = 'fake-secret-value';\n");

    const result = await scanDesktopPackage(out);

    expect(result.ok).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.violations)).not.toContain('fake-secret-value');
  });

  it('allows ordinary UI text that only mentions password or secret', async () => {
    const out = await makeOutput();
    const appDir = path.join(out, 'resources', 'app');
    await mkdir(appDir, { recursive: true });
    await writeFile(path.join(appDir, 'bundle.js'), "Enter your password to continue. Keep the secret safe. const form = { password: 'Mật khẩu bắt buộc nhập' }; const routes = { password: '/tai-khoan/doi-mat-khau' };");
    await writeFile(path.join(appDir, '.env.example'), 'VITE_API_BASE_URL=http://localhost:8080');

    const result = await scanDesktopPackage(out);

    expect(result).toEqual({ ok: true, violations: [] });
  });

  it('inspects app.asar entries for environment files and sensitive payloads', async () => {
    const out = await makeOutput();
    const appDir = path.join(root, 'app-source');
    await mkdir(path.join(appDir, 'backend'), { recursive: true });
    await mkdir(path.join(appDir, 'database'), { recursive: true });
    await writeFile(path.join(appDir, '.env'), 'VITE_API_KEY=fake-value');
    await writeFile(path.join(appDir, 'backend', 'application.yml'), 'included by mistake');
    await writeFile(path.join(appDir, 'database', 'schema.sql'), 'included by mistake');
    await writeFile(path.join(appDir, 'config.js'), "const apiSecret = 'archive-secret-value';\n");
    const resources = path.join(out, 'resources');
    await mkdir(resources, { recursive: true });
    await createPackage(appDir, path.join(resources, 'app.asar'));

    const result = await scanDesktopPackage(out);

    expect(result.ok).toBe(false);
    expect(result.violations.some(item => item.includes('.env'))).toBe(true);
    expect(result.violations.some(item => item.includes('backend'))).toBe(true);
    expect(result.violations.some(item => item.includes('database'))).toBe(true);
    expect(JSON.stringify(result.violations)).not.toContain('archive-secret-value');
  });
});
