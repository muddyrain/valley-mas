import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const aiPageSource = readFileSync(resolve(__dirname, '../src/pages/AiPage.tsx'), 'utf8');

describe('AI page surface', () => {
  it('does not expose the weak image analysis quick action in the AI tools sheet', () => {
    expect(aiPageSource).toContain('生活动作');
    expect(aiPageSource).toContain('5 个动作');
    expect(aiPageSource).toContain('label="今日穿搭"');
    expect(aiPageSource).toContain('label="拍照识别衣物"');
    expect(aiPageSource).toContain("navigate('/closet')");
    expect(aiPageSource).toContain("navigate('/ai/photo-clothing-analysis')");
    expect(aiPageSource).not.toContain('label="分析图片"');
    expect(aiPageSource).not.toContain("onQuickAction('分析图片')");
  });
});
