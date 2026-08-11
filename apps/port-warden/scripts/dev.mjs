import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

const cwd = new URL('..', import.meta.url);
const children = [];

function run(command, args, env = process.env) {
  const executable = process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command;
  const child = spawn(executable, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });
  children.push(child);
  return child;
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

const endpoint = 'http://127.0.0.1:5182';
let rendererReady = false;
for (let attempt = 0; attempt < 120; attempt += 1) {
  try {
    const response = await fetch(endpoint);
    if (response.ok) {
      rendererReady = true;
      break;
    }
  } catch {
    // Vite is still starting.
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

if (!rendererReady) throw new Error(`Renderer did not start at ${endpoint}`);

for (let attempt = 0; attempt < 120; attempt += 1) {
  try {
    await access(new URL('../dist-electron/main.cjs', import.meta.url));
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const electron = run('pnpm', ['exec', 'electron', '.']);
electron.on('exit', (code) => {
  stopChildren();
  process.exitCode = code ?? 0;
});
