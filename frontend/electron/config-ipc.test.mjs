// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createDesktopConfigHandlers, isTrustedDesktopSender } from './config-ipc.mjs';

const trustedEvent = { senderFrame: { url: 'app://desktop/admin', parent: null } };

describe('desktop config IPC', () => {
  it('accepts only the main frame on app://desktop', () => {
    expect(isTrustedDesktopSender(trustedEvent)).toBe(true);
    expect(isTrustedDesktopSender({ senderFrame: { url: 'https://desktop.example/admin', parent: null } })).toBe(false);
    expect(isTrustedDesktopSender({ senderFrame: { url: 'app://desktop.attacker/admin', parent: null } })).toBe(false);
    expect(isTrustedDesktopSender({ senderFrame: { url: 'app://desktop/admin', parent: {} } })).toBe(false);
  });

  it('returns only the current API origin and never exposes auth data', async () => {
    const handlers = createDesktopConfigHandlers({
      apiConfig: { current: () => 'https://api.example.com' },
    });
    const result = await handlers.load(trustedEvent);
    expect(result).toEqual({ apiBaseUrl: 'https://api.example.com' });
    expect(Object.keys(result)).toEqual(['apiBaseUrl']);
    expect(JSON.stringify(result)).not.toMatch(/cookie|token|secret/i);
  });

  it('rejects an untrusted sender before reading or saving config', async () => {
    const apiConfig = { current: vi.fn(), save: vi.fn() };
    const handlers = createDesktopConfigHandlers({ apiConfig });
    const untrusted = { senderFrame: { url: 'https://attacker.example/', isMainFrame: true } };
    await expect(handlers.load(untrusted)).rejects.toMatchObject({ code: 'UNTRUSTED_CONFIG_CALL' });
    await expect(handlers.save(untrusted, 'https://api.example.com')).rejects.toMatchObject({ code: 'UNTRUSTED_CONFIG_CALL' });
    expect(apiConfig.current).not.toHaveBeenCalled();
    expect(apiConfig.save).not.toHaveBeenCalled();
  });

  it('saves a validated origin, then reloads the trusted renderer and returns no auth material', async () => {
    const onSaved = vi.fn();
    const apiConfig = {
      save: vi.fn(async apiBaseUrl => ({ apiBaseUrl, changed: true })),
    };
    const handlers = createDesktopConfigHandlers({ apiConfig, onSaved });
    const result = await handlers.save(trustedEvent, 'https://api.example.com');
    expect(apiConfig.save).toHaveBeenCalledWith('https://api.example.com');
    expect(onSaved).toHaveBeenCalledWith(trustedEvent, { apiBaseUrl: 'https://api.example.com', changed: true });
    expect(result).toEqual({ apiBaseUrl: 'https://api.example.com' });
  });

  it('returns a safe validation code instead of serializing an IPC exception', async () => {
    const handlers = createDesktopConfigHandlers({
      apiConfig: { save: async () => { throw Object.assign(new Error('INSECURE_REMOTE_HTTP'), { code: 'INSECURE_REMOTE_HTTP' }); } },
    });
    await expect(handlers.save(trustedEvent, 'http://api.example.com'))
      .resolves.toEqual({ errorCode: 'INSECURE_REMOTE_HTTP' });
  });
});
