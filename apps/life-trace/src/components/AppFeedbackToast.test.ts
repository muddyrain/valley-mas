import { describe, expect, it } from 'vitest';
import { getAchievementToastPayload } from './AppFeedbackToast';

describe('getAchievementToastPayload', () => {
  it('detects a single achievement unlock toast', () => {
    expect(getAchievementToastPayload('收集到「把想法落到日历上」')).toEqual({
      title: '把想法落到日历上',
      extraText: undefined,
    });
  });

  it('keeps grouped unlocks in the achievement toast payload', () => {
    expect(getAchievementToastPayload('收集到「生活有回声」等 3 枚')).toEqual({
      title: '生活有回声',
      extraText: '另外 2 枚也已收集',
    });
  });

  it('ignores regular feedback toast copy', () => {
    expect(getAchievementToastPayload('当前已经是最新版本')).toBeNull();
  });
});
