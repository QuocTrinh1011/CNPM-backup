import path from 'node:path';

export const DESKTOP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

function rawPathFromAppUrl(value) {
  return String(value).match(/^app:\/\/[^/?#]*(\/[^?#]*)?/i)?.[1] || '/';
}

function decodeSafePath(value) {
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || /%(?:2e|2f|5c)/i.test(decoded)) return null;
  if (decoded.split('/').some(segment => segment === '.' || segment === '..')) return null;
  return decoded;
}

export function classifyAppRequest(value, assetExists = () => false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { kind: 'reject' };
  }
  if (url.protocol !== 'app:' || url.hostname !== 'desktop' || url.port || url.username || url.password) {
    return { kind: 'reject' };
  }

  const pathname = decodeSafePath(rawPathFromAppUrl(value));
  if (!pathname) return { kind: 'reject' };
  if (pathname === '/api' || pathname.startsWith('/api/')) return { kind: 'api', path: pathname };
  if (assetExists(pathname)) return { kind: 'asset', path: pathname };
  return { kind: 'spa', path: '/index.html' };
}

export function resolveDistPath(distRoot, pathname) {
  const decoded = decodeSafePath(pathname);
  if (!decoded) return null;
  const root = path.resolve(distRoot);
  const target = path.resolve(root, `.${decoded}`);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

export function withDesktopContentSecurityPolicy(response) {
  const headers = new Headers();
  for (const [name, value] of response.headers.entries()) {
    if (name.toLowerCase() !== 'set-cookie') headers.append(name, value);
  }
  if (typeof response.headers.getSetCookie === 'function') {
    for (const cookie of response.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
  }
  headers.set('Content-Security-Policy', DESKTOP_CONTENT_SECURITY_POLICY);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
