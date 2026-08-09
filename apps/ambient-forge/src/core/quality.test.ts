import { describe, expect, it } from 'vitest';
import { getQualityProfile } from './quality';

describe('quality profiles', () => {
  it('逐档提高 DPR、粒子与阴影预算', () => {
    const low = getQualityProfile('low');
    const medium = getQualityProfile('medium');
    const high = getQualityProfile('high');

    expect(low.dprCap).toBe(1);
    expect(medium.dprCap).toBe(1.5);
    expect(high.dprCap).toBe(2);
    expect(low.weatherParticles).toBeLessThan(medium.weatherParticles);
    expect(medium.fireflies).toBeLessThan(high.fireflies);
    expect(low.shadows).toBe(false);
    expect(high.shadowMapSize).toBeGreaterThan(medium.shadowMapSize);
  });
});
