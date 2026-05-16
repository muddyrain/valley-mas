import { describe, expect, it } from 'vitest';
import { TimeSystem } from './TimeSystem';

describe('TimeSystem', () => {
  it('starts at year 1 day 1 during daytime', () => {
    const system = new TimeSystem();

    expect(system.getYear()).toBe(1);
    expect(system.getDayOfYear()).toBe(1);
    expect(system.getTimeLabel()).toBe('第1年 第1/30天 白天');
    expect(system.isNight()).toBe(false);
  });

  it('advances days and years from scaled milliseconds', () => {
    const system = new TimeSystem();

    system.update(2_000);
    expect(system.getYear()).toBe(1);
    expect(system.getDayOfYear()).toBe(2);

    system.update(58_000);
    expect(system.getYear()).toBe(2);
    expect(system.getDayOfYear()).toBe(1);
  });

  it('switches between day and night within a day', () => {
    const system = new TimeSystem();

    system.update(999);
    expect(system.isNight()).toBe(false);
    expect(system.getDayProgress()).toBeGreaterThan(0);

    system.update(1);
    expect(system.isNight()).toBe(true);
    expect(system.getTimeLabel()).toBe('第1年 第1/30天 夜晚');
  });
});
