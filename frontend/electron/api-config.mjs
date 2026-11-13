function invalid(code) {
  return { ok: false, code };
}

export function validateApiBaseUrl(input) {
  if (typeof input !== 'string' || !input.trim()) return invalid('INVALID_API_ORIGIN');
  const value = input.trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    return invalid('INVALID_API_ORIGIN');
  }

  if (!['http:', 'https:'].includes(url.protocol)
    || url.username
    || url.password
    || url.pathname !== '/'
    || value.includes('?')
    || value.includes('#')) {
    return invalid('INVALID_API_ORIGIN');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (url.protocol === 'http:' && !loopback) return invalid('INSECURE_REMOTE_HTTP');

  return { ok: true, value: url.origin };
}

export function createActiveApiConfig(store, { clearAuthCookies = async () => {} } = {}) {
  let activeOrigin = null;
  let initialized = false;

  return {
    async initialize() {
      if (!initialized) {
        const saved = await store.load();
        const result = validateApiBaseUrl(saved?.apiBaseUrl);
        activeOrigin = result.ok ? result.value : null;
        initialized = true;
      }
      return activeOrigin ? { apiBaseUrl: activeOrigin } : null;
    },
    current() {
      return activeOrigin;
    },
    async save(input) {
      const result = validateApiBaseUrl(input);
      if (!result.ok) {
        const error = new Error(result.code);
        error.code = result.code;
        throw error;
      }

      const changed = result.value !== activeOrigin;
      if (changed) await clearAuthCookies();
      await store.save(result.value);
      activeOrigin = result.value;
      initialized = true;
      return { apiBaseUrl: activeOrigin, changed };
    },
  };
}
