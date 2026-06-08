import { describe, expect, it } from 'vitest';
import {
  filterAchievements,
  findNewlyUnlockedAchievements,
  getAchievementProgressMeta,
  normalizeAchievement,
} from '@/lib/achievements';
import type { Achievement } from '@/types';

const baseAchievement: Achievement = {
  code: 'first_plan',
  title: '把想法落到日历上',
  description: '创建第一个生活计划。',
  category: 'plan',
  rarity: 'common',
  icon: 'calendar-plus',
  tone: 'plan',
  hidden: false,
  unlocked: false,
  progress: 0,
  target: 1,
};

describe('achievements helpers', () => {
  it('normalizes progress within target', () => {
    expect(normalizeAchievement({ ...baseAchievement, progress: 4, target: 3 }).progress).toBe(3);
    expect(normalizeAchievement({ ...baseAchievement, progress: -1, target: 0 }).target).toBe(1);
  });

  it('filters by category', () => {
    const items = [
      baseAchievement,
      { ...baseAchievement, code: 'first_trace', category: 'trace' as const },
    ];
    expect(filterAchievements(items, 'plan')).toEqual([baseAchievement]);
    expect(filterAchievements(items, 'all')).toHaveLength(2);
  });

  it('finds newly unlocked achievements', () => {
    const previous = [baseAchievement];
    const next = [{ ...baseAchievement, unlocked: true }];
    expect(findNewlyUnlockedAchievements(previous, next)).toHaveLength(1);
  });

  it('builds gentle progress copy for locked achievements', () => {
    expect(getAchievementProgressMeta(baseAchievement)).toEqual({
      label: '等一次生活证据',
      percent: 0,
      showBar: false,
    });

    expect(getAchievementProgressMeta({ ...baseAchievement, progress: 2, target: 5 })).toEqual({
      label: '已经靠近 2/5',
      percent: 40,
      showBar: true,
    });
  });

  it('keeps collected achievements out of progress-bar mode', () => {
    expect(
      getAchievementProgressMeta({
        ...baseAchievement,
        unlocked: true,
        progress: 5,
        target: 5,
      }),
    ).toEqual({
      label: '5/5',
      percent: 100,
      showBar: false,
    });
  });
});
