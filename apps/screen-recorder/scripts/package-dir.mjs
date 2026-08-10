import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const child = spawn(process.execPath, [electronBuilderCli, '--dir'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});
process.exitCode = exitCode;
