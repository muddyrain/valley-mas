import { describe, expect, it } from 'vitest';
import { getThunderProfile } from './thunder';

describe('thunder profile', () => {
  it('远雷延迟更长、更暗且响度更低', () => {
    const near = getThunderProfile({ distance: 'near', intensity: 0.9, delaySeconds: 0.2 });
    const far = getThunderProfile({ distance: 'far', intensity: 0.9, delaySeconds: 1.2 });

    expect(far.delaySeconds).toBeGreaterThan(near.delaySeconds);
    expect(far.lowpassHz).toBeLessThan(near.lowpassHz);
    expect(far.gain).toBeLessThan(near.gain);
    expect(far.durationSeconds).toBeGreaterThan(near.durationSeconds);
  });
});
