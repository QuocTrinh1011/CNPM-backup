// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { emitDesktopBackendUnavailable } from './api-errors';

describe('desktop API error mapping', () => {
  it('emits a connection event only for BACKEND_UNREACHABLE in desktop mode', () => {
    const eventTarget = { dispatchEvent: vi.fn() };
    expect(emitDesktopBackendUnavailable('BACKEND_UNREACHABLE', 'desktop', eventTarget)).toBe(true);
    expect(eventTarget.dispatchEvent).toHaveBeenCalledOnce();
    expect(eventTarget.dispatchEvent.mock.calls[0][0].type).toBe('shop-backend-unreachable');
  });

  it('does not emit for business errors or for web portal modes', () => {
    const eventTarget = { dispatchEvent: vi.fn() };
    expect(emitDesktopBackendUnavailable('OUT_OF_STOCK', 'desktop', eventTarget)).toBe(false);
    expect(emitDesktopBackendUnavailable('BACKEND_UNREACHABLE', 'user', eventTarget)).toBe(false);
    expect(emitDesktopBackendUnavailable('BACKEND_UNREACHABLE', 'admin', eventTarget)).toBe(false);
    expect(eventTarget.dispatchEvent).not.toHaveBeenCalled();
  });
});
