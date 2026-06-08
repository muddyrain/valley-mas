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

  it('keeps async home cards behind shaped loading surfaces', () => {
    expect(todayPageSource).toContain('function TodayAchievementSkeleton');
    expect(todayPageSource).toContain('function TodayPantrySkeleton');
    expect(todayPageSource).toContain('function TodayHabitSkeleton');
    expect(todayPageSource).toContain('function TodayPlanSkeleton');
    expect(todayPageSource).toContain('achievementCardLoading');
    expect(todayPageSource).toContain('pantryCardInitialLoading');
    expect(todayPageSource).toContain('checkinsCardLoading');
    expect(todayPageSource).toContain('planCardLoading');
    expect(todayPageSource).not.toContain('正在整理库存优先级');
    expect(todayPageSource).not.toContain('这里就会直接按云端清单展示');
  });
});
