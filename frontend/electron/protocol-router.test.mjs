// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { classifyAppRequest, DESKTOP_CONTENT_SECURITY_POLICY, resolveDistPath } from './protocol-router.mjs';

const staticAssets = new Set(['/index.html', '/assets/app.js', '/assets/app.css']);
const isAsset = pathname => staticAssets.has(pathname);

describe('classifyAppRequest', () => {
  it.each(['/', '/admin', '/manager', '/manager/orders/42'])('uses the SPA document for route %s', pathname => {
    expect(classifyAppRequest(`app://desktop${pathname}`, isAsset)).toEqual({ kind: 'spa', path: '/index.html' });
  });

  it('returns existing static files and uses the SPA fallback for missing non-API files', () => {
    expect(classifyAppRequest('app://desktop/assets/app.js', isAsset)).toEqual({ kind: 'asset', path: '/assets/app.js' });
    expect(classifyAppRequest('app://desktop/assets/missing.js', isAsset)).toEqual({ kind: 'spa', path: '/index.html' });
  });

  it('never sends API paths to the SPA fallback', () => {
    expect(classifyAppRequest('app://desktop/api/products', isAsset)).toEqual({ kind: 'api', path: '/api/products' });
    expect(classifyAppRequest('app://desktop/api', isAsset)).toEqual({ kind: 'api', path: '/api' });
  });

  it.each([
    'app://evil.example/manager',
    'https://desktop/manager',
    'app://desktop/../outside',
    'app://desktop/%2e%2e/outside',
    'app://desktop/%252e%252e/outside',
    'app://desktop/%5c..%5coutside',
    'not a URL',
  ])('rejects wrong origins and traversal paths: %s', value => {
    expect(classifyAppRequest(value, isAsset).kind).toBe('reject');
  });

  it('resolves static files under dist only', () => {
    const root = 'C:\\app\\dist';
    expect(resolveDistPath(root, '/assets/app.js')).toBe('C:\\app\\dist\\assets\\app.js');
    expect(resolveDistPath(root, '/../outside.txt')).toBeNull();
  });
});

describe('desktop Content Security Policy', () => {
  it('allows only local scripts/connections while permitting product image URLs and Google Fonts', () => {
    const directives = Object.fromEntries(DESKTOP_CONTENT_SECURITY_POLICY.split(';').map(rule => {
      const [name, ...values] = rule.trim().split(/\s+/);
      return [name, values];
    }));
    expect(directives['script-src']).toEqual(["'self'"]);
    expect(directives['connect-src']).toEqual(["'self'"]);
    expect(directives['img-src']).toEqual(["'self'", 'data:', 'https:']);
    expect(directives['style-src']).toContain('https://fonts.googleapis.com');
    expect(directives['font-src']).toContain('https://fonts.gstatic.com');
    expect(DESKTOP_CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
  });
});
