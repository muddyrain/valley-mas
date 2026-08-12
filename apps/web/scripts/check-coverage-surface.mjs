import { collectTestedSourcePaths } from './coverage-surface.mjs';

const SRC_ROOT = new URL('../src', import.meta.url).pathname;

const { sourcePaths, missingSources } = collectTestedSourcePaths(SRC_ROOT);

if (!missingSources.length) {
  console.log(`Covered sources and test surfaces are in sync (${sourcePaths.length} files).`);
  process.exit(0);
}

console.error('Test files without a corresponding source module:');
for (const item of missingSources) {
  console.error(`- ${item}`);
}

process.exitCode = 1;
