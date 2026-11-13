const requestHeadersToStrip = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'referer',
  'transfer-encoding',
  'x-forwarded-for',
]);

const responseHeadersToStrip = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
]);

function isAuthPath(pathname) {
  return ['/api/auth/', '/api/admin/auth/', '/api/manager/auth/'].some(prefix => pathname.startsWith(prefix));
}

function safeResponseHeaders(source) {
  const headers = new Headers();
  for (const [name, value] of source.entries()) {
    if (!responseHeadersToStrip.has(name.toLowerCase()) && name.toLowerCase() !== 'set-cookie') {
      headers.append(name, value);
    }
  }
  if (typeof source.getSetCookie === 'function') {
    for (const value of source.getSetCookie()) headers.append('Set-Cookie', value);
  }
  return headers;
}

export async function proxyApiRequest(request, { apiBaseUrl, cookieStore, fetchImpl }) {
  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== 'app:' || requestUrl.hostname !== 'desktop' || !requestUrl.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ code: 'PROXY_PATH_REJECTED' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiOrigin = new URL(apiBaseUrl);
  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, apiOrigin);
  const headers = new Headers(request.headers);
  for (const name of requestHeadersToStrip) headers.delete(name);

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
