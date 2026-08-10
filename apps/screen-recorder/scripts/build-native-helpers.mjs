import { execFile } from 'node:child_process';
import { chmod, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = new URL('..', import.meta.url);

export async function buildNativeHelpers() {
  if (process.platform !== 'darwin') return;

  const outputDirectory = new URL('../dist-electron/native/', import.meta.url);
  const outputPath = fileURLToPath(new URL('macos-window-query', outputDirectory));
  const sourcePath = fileURLToPath(new URL('../native/macos-window-query.m', import.meta.url));
  await mkdir(outputDirectory, { recursive: true });
  await execFileAsync(
    'xcrun',
    [
      'clang',
      '-fobjc-arc',
      '-framework',
      'Foundation',
      '-framework',
      'CoreGraphics',
      '-mmacosx-version-min=12.0',
      '-arch',
      'arm64',
      '-arch',
      'x86_64',
      sourcePath,
      '-o',
      outputPath,
    ],
    { cwd: projectRoot },
  );
  await chmod(outputPath, 0o755);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildNativeHelpers();
}
