import { describe, expect, it } from 'vitest';
import { deriveAICommandTitle } from '../src/apps/aiCommandCenterHistory';

describe('AI Command Center cloud history boundary', () => {
  it('derives compact conversation titles without owning storage', () => {
    expect(deriveAICommandTitle('  帮我总结这篇文章\n第二行  ')).toBe('帮我总结这篇文章');
    expect(deriveAICommandTitle('')).toBe('新对话');
  });
});
