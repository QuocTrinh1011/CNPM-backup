import { describe, expect, it } from 'vitest';
import { buildApiUrl } from './api-url';

describe('buildApiUrl', () => {
  it('keeps the existing web API origin and API path unchanged', () => {
    expect(buildApiUrl('http://localhost:8080', '/api/products'))
      .toBe('http://localhost:8080/api/products');
  });

  it('joins the desktop /api base to existing customer and manager API paths once', () => {
    expect(buildApiUrl('/api', '/api/products')).toBe('/api/products');
    expect(buildApiUrl('/api/', '/api/manager/users?page=0')).toBe('/api/manager/users?page=0');
  });

  it('adds the desktop API prefix to a path without one', () => {
    expect(buildApiUrl('/api', '/manager/users')).toBe('/api/manager/users');
  });
});
