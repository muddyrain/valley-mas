import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const aiPageSource = readFileSync(resolve(__dirname, '../src/pages/AiPage.tsx'), 'utf8');

describe('AI page copy boundaries', () => {
  it('keeps the landing free of prescriptive daily suggestion copy', () => {
    expect(aiPageSource).not.toContain('今天适合先处理一件小事');
    expect(aiPageSource).not.toContain('补一个计划，或者把临期食材用掉');
  });
});
