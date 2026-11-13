const requestHeadersToStrip = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'origin',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'referer',
  'set-cookie',
  'set-cookie2',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-forwarded-for',
]);

const responseHeadersToStrip = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function isAuthPath(pathname) {
  return ['/api/auth/', '/api/admin/auth/', '/api/manager/auth/'].some(prefix => pathname.startsWith(prefix));
}

function safeResponseHeaders(source) {
  const headers = new Headers();
  const connectionHeaders = new Set((source.get('connection') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
  for (const [name, value] of source.entries()) {
    const normalizedName = name.toLowerCase();
    if (!responseHeadersToStrip.has(normalizedName) && !connectionHeaders.has(normalizedName) && normalizedName !== 'set-cookie' && normalizedName !== 'set-cookie2') {
      headers.append(name, value);
    }
  }
  if (typeof source.getSetCookie === 'function') {
    for (const value of source.getSetCookie()) headers.append('Set-Cookie', value);
  }
  return headers;
}

function rejectedRequest() {
  return new Response(JSON.stringify({ code: 'PROXY_PATH_REJECTED' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function safeApiPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (!decoded.startsWith('/api/') || decoded.includes('\\') || /%(?:2e|2f|5c)/i.test(decoded)) return false;
  return !decoded.split('/').some(segment => segment === '.' || segment === '..');
}

export async function proxyApiRequest(request, { apiBaseUrl, cookieStore, fetchImpl }) {
  let requestUrl;
  let apiOrigin;
  try {
    requestUrl = new URL(request.url);
    apiOrigin = new URL(apiBaseUrl);
  } catch {
    return rejectedRequest();
  }
  if (requestUrl.protocol !== 'app:' || requestUrl.hostname !== 'desktop' || !safeApiPath(requestUrl.pathname)) {
    return rejectedRequest();
  }
  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, apiOrigin);
  if (target.origin !== apiOrigin.origin || !safeApiPath(target.pathname)) return rejectedRequest();
  const headers = new Headers(request.headers);
  for (const name of requestHeadersToStrip) headers.delete(name);
  for (const name of (request.headers.get('connection') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)) {
    headers.delete(name);
  }

  if (isAuthPath(requestUrl.pathname)) {
    const cookie = cookieStore?.cookieForPath(requestUrl.pathname, request.headers.get('cookie') || '');
    if (cookie) headers.set('Cookie', cookie);
    else headers.delete('cookie');
  } else {
    headers.delete('cookie');
  }

  const init = {
    method: request.method,
    headers,
    credentials: 'omit',
    redirect: 'manual',
  };
  if (request.body && !['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body;
    init.duplex = 'half';
  }

  try {
    const response = await fetchImpl(target, init);
    cookieStore?.captureSetCookies(requestUrl.pathname, response.headers);
    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      return new Response(JSON.stringify({ code: 'UPSTREAM_REDIRECT_BLOCKED' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: safeResponseHeaders(response.headers),
    });
  } catch {
    return new Response(JSON.stringify({ code: 'BACKEND_UNREACHABLE' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
