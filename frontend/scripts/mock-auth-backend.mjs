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
  const server = createServer((request, response) => {
    const audience = audiences.find(item => request.url.startsWith(item.prefix + '/'));
    if (!audience) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ code: 'NOT_FOUND' }));
      return;
    }

    const action = request.url.slice(audience.prefix.length + 1);
    const incomingCookie = request.headers.cookie || '';
    requests.push({ audience: audience.audience, action, cookie: incomingCookie });

    if (action === 'login') {
      response.setHeader('Set-Cookie', `${audience.cookieName}=${audience.audience}-r1; HttpOnly; SameSite=Lax; Path=${audience.prefix}; Max-Age=600`);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ accessToken: `${audience.audience}-access-1` }));
      return;
    }

    const current = cookieValue(incomingCookie, audience.cookieName);
    const expected = `${audience.audience}-r1`;
    if (action === 'refresh' && current === expected) {
      response.setHeader('Set-Cookie', `${audience.cookieName}=${audience.audience}-r2; HttpOnly; SameSite=Lax; Path=${audience.prefix}; Max-Age=600`);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ accessToken: `${audience.audience}-access-2` }));
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
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}
