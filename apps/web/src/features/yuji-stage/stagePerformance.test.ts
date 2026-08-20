import { describe, expect, it } from 'vitest';
import { resolveStagePerformanceTier } from './stagePerformance';

describe('resolveStagePerformanceTier', () => {
  it('uses a static DOM experience when WebGL or motion is unavailable', () => {
    expect(
      resolveStagePerformanceTier({ reducedMotion: false, viewportWidth: 1440, webgl: false }),
    ).toBe('static');
    expect(
      resolveStagePerformanceTier({ reducedMotion: true, viewportWidth: 1440, webgl: true }),
    ).toBe('static');
  });

  it('degrades narrow and constrained devices before enabling the full stage', () => {
    expect(
      resolveStagePerformanceTier({ reducedMotion: false, viewportWidth: 390, webgl: true }),
    ).toBe('balanced');
    expect(
      resolveStagePerformanceTier({
        hardwareConcurrency: 12,
        reducedMotion: false,
        viewportWidth: 1440,
        webgl: true,
      }),
    ).toBe('full');
  });
});
