import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateApiBaseUrl } from './api-config.mjs';

export function createConfigStore(configPath) {
  return {
    async load() {
      try {
        const parsed = JSON.parse(await readFile(configPath, 'utf8'));
        const result = validateApiBaseUrl(parsed?.apiBaseUrl);
        return result.ok ? { apiBaseUrl: result.value } : null;
      } catch {
        return null;
      }
    },

    async save(input) {
      const result = validateApiBaseUrl(input);
      if (!result.ok) {
        const error = new Error(result.code);
        error.code = result.code;
        throw error;
      }

      await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
      const temporaryPath = `${configPath}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, `${JSON.stringify({ apiBaseUrl: result.value })}\n`, { encoding: 'utf8', mode: 0o600 });
        await rename(temporaryPath, configPath);
      } finally {
        await rm(temporaryPath, { force: true });
      }
      return { apiBaseUrl: result.value };
    },
  };
}
