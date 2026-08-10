import { describe, expect, it } from 'vitest';
import { createRippleWaves, stepRippleWaves } from './water-ripples';

describe('water ripple propagation', () => {
  it('冲击能量沿水面向外传播并逐渐衰减', () => {
    const waves = createRippleWaves(3);
    const next = stepRippleWaves(waves, 1, 0, 0.5);

    expect(next[0]?.radius).toBeGreaterThan(waves[0]?.radius ?? 0);
    expect(next.some((wave) => wave.amplitude > 0.4)).toBe(true);

    const decayed = stepRippleWaves(next, 0, 0, 1.5);
    expect(decayed.reduce((sum, wave) => sum + wave.amplitude, 0)).toBeLessThan(
      next.reduce((sum, wave) => sum + wave.amplitude, 0),
    );
  });

  it('冰层覆盖会抑制水波传播', () => {
    const openWater = stepRippleWaves(createRippleWaves(3), 1, 0, 0.4);
    const frozenWater = stepRippleWaves(createRippleWaves(3), 1, 0.9, 0.4);

    expect(frozenWater[0]?.amplitude).toBeLessThan(openWater[0]?.amplitude ?? 0);
    expect(frozenWater[0]?.velocity).toBeLessThan(openWater[0]?.velocity ?? 0);
  });
});
