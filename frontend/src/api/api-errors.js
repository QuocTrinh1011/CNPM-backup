export function emitDesktopBackendUnavailable(code, mode, eventTarget = typeof window === 'undefined' ? null : window) {
  if (mode !== 'desktop' || code !== 'BACKEND_UNREACHABLE' || !eventTarget?.dispatchEvent) return false;
  eventTarget.dispatchEvent(new Event('shop-backend-unreachable'));
  return true;
}
