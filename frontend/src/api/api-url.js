export function buildApiUrl(base, path) {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedPath = `/${String(path || '').replace(/^\/+/, '')}`;

  if (normalizedBase === '/api') {
    if (normalizedPath === '/api') return '/api';
    return `/api${normalizedPath.startsWith('/api/') ? normalizedPath.slice(4) : normalizedPath}`;
  }

  return `${normalizedBase}${normalizedPath}`;
}
