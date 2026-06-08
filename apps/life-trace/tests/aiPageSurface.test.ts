import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const aiPageSource = readFileSync(resolve(__dirname, '../src/pages/AiPage.tsx'), 'utf8');

describe('AI page surface', () => {
  it('does not expose the weak image analysis quick action in the AI tools sheet', () => {
    expect(aiPageSource).toContain('生活动作');
    expect(aiPageSource).toContain('3 个动作');
    expect(aiPageSource).not.toContain('label="分析图片"');
    expect(aiPageSource).not.toContain("onQuickAction('分析图片')");
  });
});
