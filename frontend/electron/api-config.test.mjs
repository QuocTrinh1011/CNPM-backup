// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createActiveApiConfig, validateApiBaseUrl } from './api-config.mjs';
import { createConfigStore } from './config-store.mjs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('validateApiBaseUrl', () => {
  it.each([
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://[::1]:8080',
    'https://api.example.com',
    'https://api.example.com:8443',
  ])('accepts a secure API origin: %s', value => {
    expect(validateApiBaseUrl(value)).toMatchObject({ ok: true, value: value.replace(/\/$/, '') });
  });

  it.each([
    ['http://api.example.com', 'INSECURE_REMOTE_HTTP'],
    ['http://user:pass@localhost:8080', 'INVALID_API_ORIGIN'],
    ['not a URL', 'INVALID_API_ORIGIN'],
    ['http://localhost:8080/api', 'INVALID_API_ORIGIN'],
    ['http://localhost:8080/?mode=desktop', 'INVALID_API_ORIGIN'],
    ['http://localhost:8080/#fragment', 'INVALID_API_ORIGIN'],
    ['file:///tmp/backend', 'INVALID_API_ORIGIN'],
  ])('rejects %s', (value, code) => {
    expect(validateApiBaseUrl(value)).toEqual({ ok: false, code });
  });

  it('normalizes a trailing slash to the API origin', () => {
    expect(validateApiBaseUrl('https://api.example.com/'))
      .toEqual({ ok: true, value: 'https://api.example.com' });
  });

  it('holds the validated startup origin in memory until a new runtime loads the edited config', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'desktop-api-config-'));
    const file = path.join(directory, 'config.json');
    try {
      const store = createConfigStore(file);
      await store.save('https://api-a.example.com');
      const running = createActiveApiConfig(store);
      expect(await running.initialize()).toEqual({ apiBaseUrl: 'https://api-a.example.com' });

      await writeFile(file, JSON.stringify({ apiBaseUrl: 'https://api-b.example.com' }));
      expect(running.current()).toBe('https://api-a.example.com');

      const nextLaunch = createActiveApiConfig(createConfigStore(file));
      expect(await nextLaunch.initialize()).toEqual({ apiBaseUrl: 'https://api-b.example.com' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('leaves invalid startup values unconfigured', async () => {
    const active = createActiveApiConfig({ load: async () => ({ apiBaseUrl: 'http://api.example.com' }) });
    expect(await active.initialize()).toBeNull();
    expect(active.current()).toBeNull();
  });

  it('clears authentication state only when saving a different validated origin', async () => {
    const saved = { apiBaseUrl: 'https://api-a.example.com' };
    const clearAuthCookies = vi.fn(async () => {});
    const store = {
      load: async () => saved,
      save: async apiBaseUrl => ({ apiBaseUrl }),
    };
    const active = createActiveApiConfig(store, { clearAuthCookies });
    await active.initialize();
    await active.save('https://api-a.example.com');
    expect(clearAuthCookies).not.toHaveBeenCalled();

    await active.save('https://api-b.example.com');
    expect(clearAuthCookies).toHaveBeenCalledOnce();
    expect(active.current()).toBe('https://api-b.example.com');
    await expect(active.save('http://api-c.example.com')).rejects.toMatchObject({ code: 'INSECURE_REMOTE_HTTP' });
    expect(active.current()).toBe('https://api-b.example.com');
  });
});
