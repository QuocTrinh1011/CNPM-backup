import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const viteCli = path.resolve(scriptDir, '../node_modules/vite/bin/vite.js');
const result = spawnSync(process.execPath, [viteCli, 'build', '--mode', 'desktop'], {
  cwd: path.resolve(scriptDir, '..'),
  env: { ...process.env, VITE_DESKTOP_API_BASE_URL: '/api' },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
