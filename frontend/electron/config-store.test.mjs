// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createConfigStore } from './config-store.mjs';

const temporaryDirectories = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function createConfigPath() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'desktop-config-store-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'settings', 'config.json');
}

describe('config store', () => {
  it('returns null when the config does not exist', async () => {
    const store = createConfigStore(await createConfigPath());
    await expect(store.load()).resolves.toBeNull();
  });

  it('saves only a normalized validated API origin and loads it on the next startup', async () => {
    const file = await createConfigPath();
    const store = createConfigStore(file);
    await expect(store.save('http://localhost:8080/')).resolves.toEqual({ apiBaseUrl: 'http://localhost:8080' });
    await expect(readFile(file, 'utf8')).resolves.toBe('{"apiBaseUrl":"http://localhost:8080"}\n');
    await expect(store.load()).resolves.toEqual({ apiBaseUrl: 'http://localhost:8080' });
  });

  it('fails closed for malformed or invalid saved configuration', async () => {
    const file = await createConfigPath();
    const store = createConfigStore(file);
    await expect(store.save('http://api.example.com')).rejects.toMatchObject({ code: 'INSECURE_REMOTE_HTTP' });
    await expect(store.load()).resolves.toBeNull();

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, '{not valid json');
    await expect(store.load()).resolves.toBeNull();
    await writeFile(file, JSON.stringify({ apiBaseUrl: 'http://api.example.com' }));
    await expect(store.load()).resolves.toBeNull();
  });
});
