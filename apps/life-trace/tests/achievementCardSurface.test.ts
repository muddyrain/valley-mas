import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const achievementCardSource = readFileSync(
  resolve(__dirname, '../src/components/AchievementCard.tsx'),
  'utf8',
);

describe('achievement card surface', () => {
  it('keeps distinct collected styles for rare and epic achievements', () => {
    expect(achievementCardSource).toContain('unlockedRarityStyles');
    expect(achievementCardSource).toContain('border-life-health/35');
    expect(achievementCardSource).toContain('border-life-plan/35');
  });
});
