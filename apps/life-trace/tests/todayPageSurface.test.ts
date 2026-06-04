import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const todayPageSource = readFileSync(resolve(__dirname, '../src/pages/TodayPage.tsx'), 'utf8');

describe('today page surface', () => {
  it('does not render the slow AI brief and today advice blocks on the home page', () => {
    expect(todayPageSource).not.toContain('data-ai-brief-card');
    expect(todayPageSource).not.toContain('今日建议</h2>');
    expect(todayPageSource).not.toContain('generateTodayAdvice');
  });
});
