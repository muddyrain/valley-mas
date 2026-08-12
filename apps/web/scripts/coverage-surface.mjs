import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const TEST_FILE_PATTERN = /\.(test|spec)\.(?:t|j)sx?$/;
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

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

    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

function resolveSourcePath(sourceBase) {
  if (SOURCE_EXTENSIONS.includes(extname(sourceBase)) && existsSync(sourceBase)) {
    return sourceBase;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = `${sourceBase}${extension}`;
    if (existsSync(candidate)) {
      return candidate;
    }

    const indexCandidate = join(sourceBase, `index${extension}`);
    if (existsSync(indexCandidate)) {
      return indexCandidate;
    }
  }

  return null;
}

function collectLocalImportSpecifiers(testPath) {
  const testText = readFileSync(testPath, 'utf8');
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of testText.matchAll(pattern)) {
      if (match[1].startsWith('.') || match[1].startsWith('@/')) {
        specifiers.add(match[1]);
      }
    }
  }

  return [...specifiers];
}

function resolveImportedSources(testPath, srcRoot) {
  const sources = [];
  for (const specifier of collectLocalImportSpecifiers(testPath)) {
    const sourceBase = specifier.startsWith('@/')
      ? join(srcRoot, specifier.slice(2))
      : resolve(dirname(testPath), specifier);
    const sourcePath = resolveSourcePath(sourceBase);
    if (sourcePath && !TEST_FILE_PATTERN.test(sourcePath)) {
      sources.push(sourcePath);
    }
  }

  return sources;
}

export function collectTestedSourcePaths(srcRoot) {
  const sourcePaths = new Set();
  const missingSources = [];

  for (const testPath of collectTestFiles(srcRoot)) {
    const importedSources = resolveImportedSources(testPath, srcRoot);
    const fallbackSource = resolveSourcePath(testPath.replace(TEST_FILE_PATTERN, ''));
    const testedSources = importedSources.length
      ? importedSources
      : [fallbackSource].filter(Boolean);

    if (!testedSources.length) {
      missingSources.push(relative(srcRoot, testPath).replaceAll('\\', '/'));
      continue;
    }

    for (const sourcePath of testedSources) {
      const relativeSourcePath = relative(srcRoot, sourcePath).replaceAll('\\', '/');
      if (!relativeSourcePath.startsWith('../')) {
        sourcePaths.add(`src/${relativeSourcePath}`);
      }
    }
  }

  return {
    sourcePaths: [...sourcePaths].sort(),
    missingSources: missingSources.sort(),
  };
}
