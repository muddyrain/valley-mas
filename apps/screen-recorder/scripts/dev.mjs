import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

const cwd = new URL('..', import.meta.url);
const children = [];

function run(command, args, env = process.env) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  children.push(child);
  return child;
}

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on('SIGINT', stopChildren);
process.on('SIGTERM', stopChildren);
process.on('exit', stopChildren);

run('pnpm', ['exec', 'vite']);
run('pnpm', ['exec', 'tsup', '--config', 'tsup.config.ts', '--watch']);

const endpoint = 'http://127.0.0.1:5179';
for (let attempt = 0; attempt < 100; attempt += 1) {
  try {
    const response = await fetch(endpoint);
    if (response.ok) break;
  } catch {
    // The local Vite process is still starting.
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

for (let attempt = 0; attempt < 100; attempt += 1) {
  try {
    await access(new URL('../dist-electron/main.cjs', import.meta.url));
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
await runOnce(process.execPath, ['scripts/build-native-helpers.mjs']);

const electron = run('pnpm', ['exec', 'electron', '.'], {
  ...process.env,
  SCREEN_RECORDER_DEV_SERVER_URL: endpoint,
});
electron.on('exit', (code) => {
  stopChildren();
  process.exitCode = code ?? 0;
});
