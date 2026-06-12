import { describe, expect, it } from 'vitest';
import { buildAssistantFailureMessage } from './assistantMessages';

describe('assistant message helpers', () => {
  it('keeps failed assistant turns as saveable conversation content', () => {
    expect(buildAssistantFailureMessage('', '请求失败：500')).toBe(
      '刚才没有连接上生活助理。你可以稍后重试，我会继续基于天气、计划和打卡来安排。(请求失败：500)',
    );
  });

  it('prefers streamed reply text when the assistant fails after partial output', () => {
    expect(buildAssistantFailureMessage('先安排晚饭', '连接中断')).toBe('先安排晚饭');
  });
});
