import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPackage = require.resolve('electron/package.json');
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
const electronDist = path.join(path.dirname(electronPackage), 'dist');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
await access(path.join(electronDist, process.platform === 'win32' ? 'electron.exe' : 'electron'));

const child = spawn(
  process.execPath,
  [electronBuilderCli, '--dir', `--config.electronDist=${electronDist}`],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  },
);

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});
process.exitCode = exitCode;
