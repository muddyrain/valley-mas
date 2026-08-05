import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const VITEST_CONFIG_PATH = new URL('../vitest.config.ts', import.meta.url).pathname;
const SRC_ROOT = new URL('../src', import.meta.url).pathname;

const VITEST_CONFIG_TEXT = readFileSync(VITEST_CONFIG_PATH, 'utf8');

function parseCoverageSources(configText) {
  const includeMatch = configText.match(/const TESTED_CORE_SOURCE_LIST\s*=\s*\[([\s\S]*?)\]\s*as const;?/);
  const groupedMatch = configText.match(/const TESTED_CORE_SOURCES\s*=\s*\{([\s\S]*?)\}\s*as const;?/);

  if (includeMatch && /'|"/.test(includeMatch[1])) {
    return new Set(Array.from(includeMatch[1].matchAll(/['"]([^'"]+)['"]/g)).map(([, path]) => path));
  }

  if (groupedMatch && /'|"/.test(groupedMatch[1])) {
    return new Set(
      Array.from(groupedMatch[1].matchAll(/['"]([^'"]+)['"]/g)).map(([, path]) => path),
    );
  }

  throw new Error('Unable to locate a quoted file list in coverage config');
}

const includeSet = parseCoverageSources(VITEST_CONFIG_TEXT);

function collectTestFiles(dir, fileList = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(fullPath, fileList);
      continue;
    }

    if (entry.isFile() && /\.(test|spec)\.(?:t|j)sx?$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

const testFiles = collectTestFiles(SRC_ROOT);
const expectedFromTests = new Set();

for (const testPath of testFiles) {
  const relativePath = relative(SRC_ROOT, testPath);
  const normalized = relativePath.replaceAll('\\', '/');
  const sourcePath = normalized.replace(
    /\.(test|spec)\.(t|j)sx?$/,
    (match) => (match.endsWith('jsx') || match.endsWith('tsx') ? '.tsx' : '.ts'),
  );
  expectedFromTests.add(`src/${sourcePath}`);
}

const missingTests = [...includeSet].filter((item) => !expectedFromTests.has(item)).sort();
const missingFromList = [...expectedFromTests].filter((item) => !includeSet.has(item)).sort();

if (!missingTests.length && !missingFromList.length) {
  console.log(`Covered sources and test surfaces are in sync (${includeSet.size} files).`);
  process.exit(0);
}

if (missingTests.length) {
  console.error('Sources in coverage include list without corresponding *.test file:');
  for (const item of missingTests) {
    console.error(`- ${item}`);
  }
}

if (missingFromList.length) {
  console.error('Source files with tests but not in coverage include list:');
  for (const item of missingFromList) {
    console.error(`- ${item}`);
  }
}

process.exitCode = 1;
