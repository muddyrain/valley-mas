import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { collectTestedSourcePaths } from './scripts/coverage-surface.mjs';

const SRC_ROOT = path.resolve(__dirname, 'src');
const { sourcePaths: TESTED_SOURCE_LIST, missingSources } = collectTestedSourcePaths(SRC_ROOT);

if (missingSources.length) {
  throw new Error(`Test files without a corresponding source module: ${missingSources.join(', ')}`);
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environmentMatchGlobs: [['**/*.test.jsx', 'jsdom']],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Keep coverage scoped to modules with existing test surface.
      all: false,
      include: TESTED_SOURCE_LIST,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
      thresholds: {
        branches: 20,
        functions: 20,
        lines: 30,
        statements: 30,
      },
    },
  },
});
