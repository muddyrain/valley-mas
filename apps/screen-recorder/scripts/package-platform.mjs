import { spawn, spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requestedPlatform = process.argv[2];
const isMacRelease = requestedPlatform === 'mac' && process.argv.includes('--release');
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
if (requestedPlatform === 'mac') {
  const identities = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
    encoding: 'utf8',
    shell: false,
  });
  const identityOutput = `${identities.stdout ?? ''}\n${identities.stderr ?? ''}`;
  const hasKeychainIdentity = /\b[1-9]\d* valid identities found\b/.test(identityOutput);
  const hasKeychainDeveloperId = /"Developer ID Application:[^"]+"/.test(identityOutput);
  const configuredIdentity = process.env.CSC_NAME?.trim();
  const hasExternalCertificate = Boolean(process.env.CSC_LINK?.trim());
  const hasSigningCredential =
    hasExternalCertificate || Boolean(configuredIdentity) || hasKeychainIdentity;
  const hasDeveloperIdCredential =
    hasExternalCertificate ||
    Boolean(configuredIdentity?.startsWith('Developer ID Application:')) ||
    hasKeychainDeveloperId;
  const hasNotarizationCredential =
    Boolean(
      process.env.APPLE_API_KEY?.trim() &&
        process.env.APPLE_API_KEY_ID?.trim() &&
        process.env.APPLE_API_ISSUER?.trim(),
    ) ||
    Boolean(
      process.env.APPLE_ID?.trim() &&
        process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim() &&
        process.env.APPLE_TEAM_ID?.trim(),
    ) ||
    Boolean(process.env.APPLE_KEYCHAIN?.trim() && process.env.APPLE_KEYCHAIN_PROFILE?.trim());

  if (isMacRelease && !hasDeveloperIdCredential) {
    throw new Error(
      'macOS 正式发布需要 Developer ID Application 证书。请安装到钥匙串，或通过 CSC_LINK/CSC_KEY_PASSWORD 提供。',
    );
  }
  if (isMacRelease && !hasNotarizationCredential) {
    throw new Error(
      'macOS 正式发布缺少 Apple notarization 凭据。请配置 App Store Connect API Key、Apple ID 专用密码或 notarytool 钥匙串 profile。',
    );
  }
  if (isMacRelease) {
    builderArgs.push('--config.forceCodeSigning=true');
  } else if (!hasSigningCredential) {
    console.warn(
      '[screen-recorder] 未找到 Apple 代码签名证书，本次回退到 ad-hoc 签名；代码变化后 macOS 可能要求重新添加录屏权限。',
    );
    builderArgs.push(
      '--config.mac.identity=-',
      '--config.mac.hardenedRuntime=false',
      '--config.mac.notarize=false',
    );
  } else if (!hasNotarizationCredential) {
    console.warn(
      '[screen-recorder] 当前 macOS 包会使用可用证书签名，但因缺少 notarization 凭据不会作为正式发布包公证。',
    );
    builderArgs.push('--config.mac.notarize=false');
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
