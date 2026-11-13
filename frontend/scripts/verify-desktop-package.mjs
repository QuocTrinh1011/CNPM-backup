import { lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractAll } from '@electron/asar';

const TEXT_EXTENSIONS = new Set([
  '.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.sql', '.txt', '.xml', '.yaml', '.yml',
]);
const CREDENTIAL_ASSIGNMENT = /\b(?:password|passwd|secret|token|api[_-]?key|apiSecret|clientSecret|accessToken|refreshToken|jwtSecret|[a-z0-9]+[_-](?:password|passwd|secret|token|api[_-]?key|checksum[_-]?key|access[_-]?token|refresh[_-]?token))\b\s*[:=]\s*(['"`])([^'"`\r\n]{4,})\1/gi;

function normalizedRelativePath(relativePath) {
  return relativePath.split(path.sep).join('/').replace(/^\/+/, '');
}

function isEnvironmentFile(relativePath) {
  const fileName = path.posix.basename(normalizedRelativePath(relativePath)).toLowerCase();
  return fileName !== '.env.example' && /^\.env(?:\..*)?$/.test(fileName);
}

function hasForbiddenPayloadPath(relativePath) {
  return normalizedRelativePath(relativePath).split('/').some(segment => /^(backend|database)$/i.test(segment));
}

function hasCredentialAssignment(contents) {
  CREDENTIAL_ASSIGNMENT.lastIndex = 0;
  for (const match of contents.matchAll(CREDENTIAL_ASSIGNMENT)) {
    const value = match[2].trim();
    if (value.length >= 4 && !/[\s/\\]/.test(value)) return true;
  }
  return false;
}

async function scanDirectory(directory, displayPrefix, violations) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const diskPath = path.join(directory, entry.name);
    const relativePath = normalizedRelativePath(path.posix.join(displayPrefix, entry.name));

    if (isEnvironmentFile(relativePath)) violations.add(`environment file included: ${relativePath}`);
    if (hasForbiddenPayloadPath(relativePath)) violations.add(`backend/database payload included: ${relativePath}`);

    if (entry.isSymbolicLink()) {
      violations.add(`symbolic link cannot be inspected safely: ${relativePath}`);
      continue;
    }
    if (entry.isDirectory()) {
      await scanDirectory(diskPath, relativePath, violations);
      continue;
    }
    if (!entry.isFile()) continue;

    if (path.extname(entry.name).toLowerCase() === '.asar') {
      const extractionDir = await mkdtemp(path.join(os.tmpdir(), 'desktop-asar-scan-'));
      try {
        await extractAll(diskPath, extractionDir);
        await scanDirectory(extractionDir, relativePath, violations);
      } catch {
        violations.add(`unable to inspect archive: ${relativePath}`);
      } finally {
        await rm(extractionDir, { recursive: true, force: true });
      }
      continue;
    }

    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const contents = await readFile(diskPath, 'utf8');
    if (hasCredentialAssignment(contents)) violations.add(`credential-like assignment included: ${relativePath}`);
  }
}

export async function scanDesktopPackage(outDir) {
  const violations = new Set();
  try {
    const info = await lstat(outDir);
    if (!info.isDirectory()) {
      return { ok: false, violations: ['package output path is not a directory'] };
    }
    await scanDirectory(outDir, '', violations);
  } catch {
    violations.add('package output path is missing or unreadable');
  }
  const sortedViolations = [...violations].sort();
  return { ok: sortedViolations.length === 0, violations: sortedViolations };
}

async function runCli() {
  const outputDirectory = path.resolve(process.argv[2] || 'out');
  const result = await scanDesktopPackage(outputDirectory);
  if (result.ok) {
    console.log(`Desktop package verified: ${outputDirectory}`);
    return;
  }
  console.error('Desktop package verification failed:');
  for (const violation of result.violations) console.error(`- ${violation}`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runCli();
}
