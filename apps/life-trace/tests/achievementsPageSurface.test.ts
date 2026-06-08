import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const achievementsPageSource = readFileSync(
  resolve(__dirname, '../src/pages/AchievementsPage.tsx'),
  'utf8',
);

describe('achievements page surface', () => {
  it('keeps a recent unlock timeline on the achievements page', () => {
    expect(achievementsPageSource).toContain('最近解锁');
    expect(achievementsPageSource).toContain('RecentAchievementItem');
  });
});
