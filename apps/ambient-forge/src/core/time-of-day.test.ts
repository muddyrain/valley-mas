import { describe, expect, it } from 'vitest';
import { getTimeOfDayState } from './time-of-day';

describe('getTimeOfDayState', () => {
  it('在昼夜阶段之间连续插值而不是硬切换', () => {
    const before = getTimeOfDayState(16.99);
    const after = getTimeOfDayState(17.01);

    expect(Math.abs(before.daylight - after.daylight)).toBeLessThan(0.02);
    expect(Math.abs(before.sky[0] - after.sky[0])).toBeLessThan(0.02);
  });

  it('夜晚提升星空与小屋灯光，正午提升太阳高度', () => {
    const midnight = getTimeOfDayState(0);
    const noon = getTimeOfDayState(12);

    expect(midnight.stars).toBeGreaterThan(0.8);
    expect(midnight.cabinLight).toBeGreaterThan(0.8);
    expect(noon.sunElevation).toBeGreaterThan(0.9);
    expect(noon.stars).toBeLessThan(0.1);
  });
});
