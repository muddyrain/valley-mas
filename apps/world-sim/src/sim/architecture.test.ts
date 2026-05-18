import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const simModulePaths = [
  './SimLoop',
  './SimWorld',
  './index',
  './map',
  './rng',
  './spatialIndex',
  './types',
];

describe('simulation architecture boundary', () => {
  it('keeps sim modules free of Phaser imports', async () => {
    for (const modulePath of simModulePaths) {
      const module = await import(modulePath);
      expect(module).toBeTruthy();
    }
  });

  it('keeps sim source free of Phaser and browser globals', () => {
    const simDir = dirname(fileURLToPath(import.meta.url));
    const forbiddenPatterns = [
      /from ['"]phaser['"]/,
      /import\s+\*\s+as\s+Phaser/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\bHTMLElement\b/,
    ];

    for (const modulePath of simModulePaths) {
      const source = readFileSync(join(simDir, `${modulePath.slice(2)}.ts`), 'utf8');

      for (const pattern of forbiddenPatterns) {
        expect(source, `${modulePath} should not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
