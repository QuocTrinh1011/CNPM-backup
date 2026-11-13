// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { approvedExternalUrl, installNavigationGuards, isDesktopAppUrl } from './external-links.mjs';

describe('approvedExternalUrl', () => {
  it('allows only HTTPS on the exact PayOS checkout host', () => {
    expect(approvedExternalUrl('https://pay.payos.vn/web/123').href).toBe('https://pay.payos.vn/web/123');
    for (const value of [
      'http://pay.payos.vn/web/123',
      'https://pay.payos.vn.evil.example/web/123',
      'https://evil.example/',
      'https://user@pay.payos.vn/',
      'https://pay.payos.vn:444/web/123',
      'javascript:alert(1)',
      'mailto:pay@payos.vn',
    ]) expect(approvedExternalUrl(value)).toBeNull();
  });

  it('recognizes only app://desktop as the in-app origin', () => {
    expect(isDesktopAppUrl('app://desktop/manager')).toBe(true);
    expect(isDesktopAppUrl('app://desktop.attacker/manager')).toBe(false);
    expect(isDesktopAppUrl('app://desktop:777/manager')).toBe(false);
    expect(isDesktopAppUrl('https://pay.payos.vn/')).toBe(false);
  });

  it('blocks new windows and redirects only the approved external host through shell.openExternal', () => {
    const listeners = new Map();
    const setWindowOpenHandler = vi.fn(handler => { listeners.set('window-open', handler); });
    const webContents = {
      setWindowOpenHandler,
      on: vi.fn((event, handler) => listeners.set(event, handler)),
    };
    const shell = { openExternal: vi.fn() };
    installNavigationGuards(webContents, shell);

    expect(listeners.get('window-open')({ url: 'https://pay.payos.vn/checkout' })).toEqual({ action: 'deny' });
    expect(shell.openExternal).toHaveBeenCalledWith('https://pay.payos.vn/checkout');
    expect(listeners.get('window-open')({ url: 'https://evil.example/' })).toEqual({ action: 'deny' });
    expect(shell.openExternal).toHaveBeenCalledOnce();

    const payosNavigation = { preventDefault: vi.fn() };
    listeners.get('will-navigate')(payosNavigation, 'https://pay.payos.vn/checkout');
    expect(payosNavigation.preventDefault).toHaveBeenCalledOnce();
    expect(shell.openExternal).toHaveBeenCalledTimes(2);

    const appNavigation = { preventDefault: vi.fn() };
    listeners.get('will-navigate')(appNavigation, 'app://desktop/admin');
    expect(appNavigation.preventDefault).not.toHaveBeenCalled();

    const untrustedNavigation = { preventDefault: vi.fn() };
    listeners.get('will-redirect')(untrustedNavigation, 'https://evil.example/');
    expect(untrustedNavigation.preventDefault).toHaveBeenCalledOnce();
  });
});
