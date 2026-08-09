import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const directory of ['dist', 'dist-electron', 'release', 'release-artifacts', 'artifacts']) {
  const target = path.resolve(projectRoot, directory);
  if (path.dirname(target) !== projectRoot) {
    throw new Error(`拒绝清理项目目录外路径：${target}`);
  }
  await rm(target, { recursive: true, force: true });
}
