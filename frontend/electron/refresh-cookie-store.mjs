const scopes = [
  { name: 'refreshToken', path: '/api/auth' },
  { name: 'adminRefreshToken', path: '/api/admin/auth' },
  { name: 'managerRefreshToken', path: '/api/manager/auth' },
];

function scopeForPath(pathname) {
  return scopes.find(scope => pathname === scope.path || pathname.startsWith(`${scope.path}/`));
}

function matchingCookie(header, name) {
  return String(header || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`)) || null;
}

function cookieExpired(value, attributes) {
  if (value === '') return true;
  const maxAge = attributes.get('max-age');
  if (maxAge !== undefined && Number(maxAge) <= 0) return true;
  const expires = attributes.get('expires');
  return expires !== undefined && Number.isFinite(Date.parse(expires)) && Date.parse(expires) <= Date.now();
}

export function createRefreshCookieStore() {
  const values = new Map();
  return {
    cookieForPath(pathname, browserCookieHeader = '') {
      const scope = scopeForPath(pathname);
      if (!scope) return null;
      return matchingCookie(browserCookieHeader, scope.name) || values.get(scope.name) || null;
    },
    captureSetCookies(pathname, headers) {
      const scope = scopeForPath(pathname);
      if (!scope || typeof headers?.getSetCookie !== 'function') return;
      for (const raw of headers.getSetCookie()) {
        const parts = String(raw).split(';').map(part => part.trim());
        const separator = parts[0].indexOf('=');
        if (separator < 1 || parts[0].slice(0, separator) !== scope.name) continue;
        const value = parts[0].slice(separator + 1);
        const attributes = new Map(parts.slice(1).map(part => {
          const index = part.indexOf('=');
          return index < 0 ? [part.toLowerCase(), ''] : [part.slice(0, index).toLowerCase(), part.slice(index + 1)];
        }));
        if (attributes.get('path') !== scope.path || cookieExpired(value, attributes)) {
          values.delete(scope.name);
        } else {
          values.set(scope.name, `${scope.name}=${value}`);
        }
      }
    },
    clearAll() {
      values.clear();
    },
  };
}
