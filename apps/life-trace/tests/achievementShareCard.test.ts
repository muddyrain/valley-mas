import { describe, expect, it, vi } from 'vitest';
import {
  createAchievementShareCardFile,
  getAchievementShareFilename,
} from '../src/lib/achievementShareCard';
import type { Achievement } from '../src/types';

const achievement: Achievement = {
  code: 'first_plan',
  title: '把想法落到日历上',
  description: '创建第一个生活计划。',
  category: 'plan',
  rarity: 'common',
  icon: 'calendar-plus',
  tone: 'plan',
  hidden: false,
  unlocked: true,
  unlockedAt: '2026-06-08T10:00:00Z',
  progress: 1,
  target: 1,
  aiComment: '你把今天的小念头安稳放进了生活里。',
};

describe('achievement share card', () => {
  it('builds a stable png filename from the achievement code', () => {
    expect(getAchievementShareFilename(achievement)).toBe('life-trace-achievement-first-plan.png');
  });

  it('wraps rendered png bytes into a shareable file', async () => {
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    const render = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));

    const file = await createAchievementShareCardFile(achievement, { render });

    expect(file.name).toBe('life-trace-achievement-first-plan.png');
    expect(file.type).toBe('image/png');
    expect(render).toHaveBeenCalledWith(achievement);
  });

  it('rejects non-png renderer output', async () => {
    const render = vi.fn(async () => new Blob(['svg'], { type: 'image/svg+xml' }));

    await expect(createAchievementShareCardFile(achievement, { render })).rejects.toThrow(
      '分享卡生成失败',
    );
  });

  it('supports achievements without AI comments', async () => {
    const render = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
    const file = await createAchievementShareCardFile(
      { ...achievement, aiComment: undefined },
      { render },
    );

    expect(file.type).toBe('image/png');
  });
});
