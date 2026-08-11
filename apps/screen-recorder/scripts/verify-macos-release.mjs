import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') {
  throw new Error('macOS 正式发布包只能在 macOS 主机上验证');
}

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const appPaths = [
  path.join(projectRoot, 'package-output/mac/Valley Screen Recorder.app'),
  path.join(projectRoot, 'package-output/mac-arm64/Valley Screen Recorder.app'),
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: false,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 验证失败：\n${output}`);
  }
  return output;
}

for (const appPath of appPaths) {
  await access(appPath);
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  const signature = run('codesign', ['--display', '--verbose=4', appPath]);
  if (!signature.includes('Authority=Developer ID Application:')) {
    throw new Error(`${appPath} 未使用 Developer ID Application 签名`);
  }
  if (signature.includes('TeamIdentifier=not set')) {
    throw new Error(`${appPath} 缺少 Apple Team Identifier`);
  }
  run('spctl', ['--assess', '--verbose=4', '--type', 'execute', appPath]);
  run('xcrun', ['stapler', 'validate', appPath]);
  console.log(`[screen-recorder] macOS 正式发布验证通过：${appPath}`);
}
