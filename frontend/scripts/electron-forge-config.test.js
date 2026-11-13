// @vitest-environment node
import { describe, expect, it } from 'vitest';
import forgeConfig from '../electron-forge.config.mjs';

const shouldIgnore = forgeConfig.packagerConfig.ignore;

describe('Electron Forge production allowlist', () => {
  it.each(['/package.json', '/electron/main.mjs', '/electron/preload.cjs', '/dist/index.html', '/node_modules/react/index.js'])(
    'includes runtime path %s', filePath => {
      expect(shouldIgnore(filePath)).toBe(false);
    },
  );

  it.each([
    '/backend/src/main/App.java',
    '/database/schema.sql',
    '/.env',
    '/scripts/build-desktop.mjs',
    '/electron/main.test.mjs',
    '/electron/test/auth-fixture.html',
    '/node_modules/.bin/electron',
    '/node_modules/electron/index.js',
    '/node_modules/electron-squirrel-startup/test/index.test.js',
  ])('excludes non-runtime path %s', filePath => {
    expect(shouldIgnore(filePath)).toBe(true);
  });
});
