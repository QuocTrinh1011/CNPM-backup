import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const allowedElectronFiles = new Set([
  'electron/api-config.mjs',
  'electron/api-proxy.mjs',
  'electron/config-ipc.mjs',
  'electron/config-store.mjs',
  'electron/external-links.mjs',
  'electron/main.mjs',
  'electron/preload.cjs',
  'electron/protocol-router.mjs',
  'electron/refresh-cookie-store.mjs',
]);

function ignoreUnlistedFiles(filePath) {
  const normalizedPath = String(filePath).replace(/\\/g, '/');
  const normalizedRoot = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const relativePath = normalizedPath.toLowerCase().startsWith(`${normalizedRoot.toLowerCase()}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath.replace(/^\/+/, '');
  if (!relativePath || relativePath === '.') return false;
  const segments = relativePath.split('/');
  if (segments.some(segment => ['test', 'tests', '__tests__'].includes(segment.toLowerCase()))) return true;
  if (/\.(?:test|spec)\.[cm]?js$/i.test(relativePath)) return true;
  if (segments.includes('.git') || /\.(?:o|obj)$/i.test(relativePath)) return true;
  if (segments[0] === 'node_modules' && ['.bin', 'electron'].includes(segments[1])) return true;
  if (relativePath === 'dist' || relativePath.startsWith('dist/')) return false;
  if (relativePath === 'node_modules' || relativePath.startsWith('node_modules/')) return false;
  if (relativePath === 'electron') return false;
  if (relativePath.startsWith('electron/')) return !allowedElectronFiles.has(relativePath);
  return relativePath !== 'package.json';
}

export default {
  packagerConfig: {
    asar: true,
    executableName: 'AnhLonShop',
    ignore: ignoreUnlistedFiles,
    overwrite: true,
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'AnhLonShopDesktop',
        authors: 'ANH LỚN SHOP',
        description: 'Ứng dụng desktop Windows cho hệ thống CRM ANH LỚN SHOP',
        noMsi: true,
        setupExe: 'AnhLonShop-Setup.exe',
      },
    },
  ],
  outDir: 'out',
};
