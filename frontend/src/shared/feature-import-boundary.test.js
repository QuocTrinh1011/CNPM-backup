import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const featureRoot = path.join(sourceRoot, 'features');

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? filesUnder(entryPath)
      : /\.(jsx?|mjs)$/.test(entry.name) ? [entryPath] : [];
  });
}

function importsIn(source) {
  const specifiers = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\bvi\.mock\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers;
}

it('keeps shared and feature imports within the allowed dependency direction', () => {
  const violations = [];
  const sources = [
    ...filesUnder(featureRoot).map(file => ({ file, layer: 'feature' })),
    ...filesUnder(path.join(sourceRoot, 'shared')).map(file => ({ file, layer: 'shared' })),
  ];

  for (const { file, layer } of sources) {
    const sourceFeature = layer === 'feature'
      ? path.relative(featureRoot, file).split(path.sep)[0]
      : null;
    for (const specifier of importsIn(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      const target = path.relative(sourceRoot, path.resolve(path.dirname(file), specifier)).split(path.sep).join('/');
      const targetFeature = target.startsWith('features/') ? target.split('/')[1] : null;
      const entersApp = target === 'app' || target.startsWith('app/');
      const entersFeature = targetFeature !== null;
      const forbidden = layer === 'shared'
        ? entersApp || entersFeature
        : entersApp || (entersFeature && targetFeature !== sourceFeature);
      if (forbidden) violations.push(path.relative(sourceRoot, file) + ' -> ' + specifier);
    }
  }

  expect(violations, violations.join('\n')).toEqual([]);
});
