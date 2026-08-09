import { describe, expect, it } from 'vitest';
import { derivePrecipitationMotion } from './precipitation-motion';

describe('derivePrecipitationMotion', () => {
  it('强风同时增加雨滴横向速度、倾角和雨线长度', () => {
    const calm = derivePrecipitationMotion({
      wind: 0,
      intensity: 0.8,
      elapsed: 1.4,
      motionScale: 1,
    });
    const storm = derivePrecipitationMotion({
      wind: 1,
      intensity: 0.8,
      elapsed: 1.4,
      motionScale: 1,
    });

    expect(Math.abs(storm.velocityX)).toBeGreaterThan(Math.abs(calm.velocityX) + 5);
    expect(Math.abs(storm.velocityZ)).toBeGreaterThan(Math.abs(calm.velocityZ) + 0.5);
    expect(Math.abs(storm.streakX)).toBeGreaterThan(Math.abs(calm.streakX) + 0.3);
    expect(storm.streakLength).toBeGreaterThan(calm.streakLength);
    expect(storm.streakLength).toBeLessThanOrEqual(1.3);
  });

  it('阵风随时间变化且 reduced-motion 只压低脉动、不移除基础风向', () => {
    const first = derivePrecipitationMotion({
      wind: 0.85,
      intensity: 1,
      elapsed: 0.2,
      motionScale: 1,
    });
    const later = derivePrecipitationMotion({
      wind: 0.85,
      intensity: 1,
      elapsed: 1.1,
      motionScale: 1,
    });
    const reduced = derivePrecipitationMotion({
      wind: 0.85,
      intensity: 1,
      elapsed: 1.1,
      motionScale: 0.24,
    });

    expect(later.gust).not.toBeCloseTo(first.gust, 2);
    expect(reduced.gustVariation).toBeLessThan(later.gustVariation);
    expect(Math.abs(reduced.velocityX)).toBeGreaterThan(4);
    expect(Math.sign(reduced.velocityX)).toBe(Math.sign(later.velocityX));
  });
});
