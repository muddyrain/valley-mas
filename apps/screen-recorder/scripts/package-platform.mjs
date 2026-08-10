import { spawn, spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requestedPlatform = process.argv[2];
const expectedHost =
  requestedPlatform === 'win' ? 'win32' : requestedPlatform === 'mac' ? 'darwin' : undefined;
if (!expectedHost) throw new Error('打包平台必须是 win 或 mac');
if (process.platform !== expectedHost) {
  throw new Error(
    requestedPlatform === 'mac'
      ? 'macOS 安装包必须在 macOS 主机上构建'
      : 'Windows 安装包必须在 Windows 主机上构建',
  );
}

const require = createRequire(import.meta.url);
const electronPackage = require.resolve('electron/package.json');
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
const electronDist = path.join(path.dirname(electronPackage), 'dist');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const builderArgs = [electronBuilderCli, `--${requestedPlatform}`];
if (requestedPlatform === 'win') {
  await access(path.join(electronDist, 'electron.exe'));
  builderArgs.push(`--config.electronDist=${electronDist}`);
}
if (requestedPlatform === 'mac' && !process.env.CSC_NAME?.trim()) {
  const identities = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
    encoding: 'utf8',
    shell: false,
  });
  const identityOutput = `${identities.stdout ?? ''}\n${identities.stderr ?? ''}`;
  if (!/\b[1-9]\d* valid identities found\b/.test(identityOutput)) {
    console.warn(
      '[screen-recorder] 未找到 Apple 代码签名证书，本次回退到 ad-hoc 签名；代码变化后 macOS 可能要求重新添加录屏权限。',
    );
    builderArgs.push('--config.mac.identity=-');
  }
}

const child = spawn(process.execPath, builderArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});
process.exitCode = exitCode;
