import { createServer } from 'node:http';

const audiences = [
  { prefix: '/api/auth', cookieName: 'refreshToken', audience: 'customer' },
  { prefix: '/api/admin/auth', cookieName: 'adminRefreshToken', audience: 'admin' },
  { prefix: '/api/manager/auth', cookieName: 'managerRefreshToken', audience: 'manager' },
];

function cookieValue(header, name) {
  return String(header || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

export async function startMockAuthBackend() {
  const requests = [];
  let unavailable = false;
  const server = createServer(async (request, response) => {
    if (unavailable) {
      request.socket.destroy();
      return;
    }

    const audience = audiences.find(item => request.url.startsWith(item.prefix + '/'));
    if (!audience) {
      requests.push({ audience: 'api', action: `${request.method} ${request.url}`, cookie: request.headers.cookie || '' });
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      const body = pathname === '/api/products/categories'
        ? []
        : pathname === '/api/manager/orders/summary'
          ? {}
          : { content: [], totalElements: 0, totalPages: 0, number: 0 };
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
      return;
    }

    const action = request.url.slice(audience.prefix.length + 1);
    const incomingCookie = request.headers.cookie || '';
    requests.push({ audience: audience.audience, action, cookie: incomingCookie });

    if (action === 'login') {
      let credentials = {};
      try {
        credentials = JSON.parse(await awaitRequestBody(request));
      } catch {
        // Authentication responses stay deterministic for malformed test requests.
      }
      if (!String(credentials.email || '').endsWith('@example.test') || credentials.password !== 'test-only-password') {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ code: 'INVALID_CREDENTIALS' }));
        return;
      }
      response.setHeader('Set-Cookie', `${audience.cookieName}=${audience.audience}-r1; HttpOnly; SameSite=Lax; Path=${audience.prefix}; Max-Age=600`);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(sessionFor(audience.audience, 1)));
      return;
    }

    const current = cookieValue(incomingCookie, audience.cookieName);
    const expected = `${audience.audience}-r1`;
    if (action === 'refresh' && current === expected) {
      response.setHeader('Set-Cookie', `${audience.cookieName}=${audience.audience}-r2; HttpOnly; SameSite=Lax; Path=${audience.prefix}; Max-Age=600`);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(sessionFor(audience.audience, 2)));
      return;
    }
    if (action === 'logout' && current === `${audience.audience}-r2`) {
      response.setHeader('Set-Cookie', `${audience.cookieName}=; HttpOnly; SameSite=Lax; Path=${audience.prefix}; Max-Age=0`);
      response.writeHead(204);
      response.end();
      return;
    }

    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ code: 'INVALID_REFRESH_TOKEN' }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    setUnavailable(value) { unavailable = Boolean(value); },
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

function sessionFor(audience, tokenVersion) {
  const account = audience === 'customer'
    ? { id: 101, fullName: 'E2E Customer', email: 'customer@example.test' }
    : audience === 'admin'
      ? { id: 201, email: 'admin@example.test', role: 'ADMIN' }
      : { id: 301, fullName: 'E2E Manager', email: 'manager@example.test', role: 'MANAGER_SALES' };
  return { accessToken: `${audience}-access-${tokenVersion}`, [audience]: account };
}

function awaitRequestBody(request) {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  return new Promise((resolve, reject) => {
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}
