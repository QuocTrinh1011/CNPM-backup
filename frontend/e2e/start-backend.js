import { spawn } from 'node:child_process';
import { createE2EBackendEnvironment, getE2EDatabaseSettings } from './database.js';

const database = getE2EDatabaseSettings();
const env = createE2EBackendEnvironment(process.env, database);
const isWindows = process.platform === 'win32';
const backendOptions = {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
};
const backend = isWindows
  ? spawn('mvn.cmd -B -ntp -f ../backend/pom.xml spring-boot:run', { ...backendOptions, shell: true })
  : spawn('mvn', ['-B', '-ntp', '-f', '../backend/pom.xml', 'spring-boot:run'], backendOptions);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => backend.kill(signal));
}

backend.on('error', (error) => {
  console.error(`Could not start the E2E backend: ${error.message}`);
  process.exitCode = 1;
});

backend.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
