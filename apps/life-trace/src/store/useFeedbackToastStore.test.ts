import { afterEach, describe, expect, it } from 'vitest';
import type { Achievement } from '@/types';
import { useFeedbackToastStore } from './useFeedbackToastStore';

const achievement: Achievement = {
  code: 'first_plan',
  title: '把想法落到日历上',
  description: '创建第一条生活计划。',
  category: 'plan',
  rarity: 'common',
  icon: 'calendar-plus',
  tone: 'plan',
  hidden: false,
  unlocked: true,
  unlockedAt: '2026-06-08T08:00:00Z',
  progress: 1,
  target: 1,
};

afterEach(() => {
  const activeTimer = useFeedbackToastStore.getState().timer;
  if (activeTimer) {
    globalThis.clearTimeout(activeTimer);
  }
  useFeedbackToastStore.setState({ current: null, timer: null });
});

describe('useFeedbackToastStore', () => {
  it('stores optional achievement detail payload for unlock toasts', () => {
    useFeedbackToastStore.getState().showToast('收集到「把想法落到日历上」', 'success', 4200, {
      achievement,
      achievementExtraCount: 2,
    });

    expect(useFeedbackToastStore.getState().current).toMatchObject({
      message: '收集到「把想法落到日历上」',
      tone: 'success',
      achievement,
      achievementExtraCount: 2,
    });
  });
});
