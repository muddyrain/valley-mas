import { describe, expect, it } from 'vitest';
import { getQualityProfile } from './quality';
import { shouldResizeRendererForQuality } from './quality-runtime';

describe('quality runtime', () => {
  it('skips a renderer resize when the effective pixel ratio stays unchanged', () => {
    expect(shouldResizeRendererForQuality(1, 1, getQualityProfile('low'))).toBe(false);
    expect(shouldResizeRendererForQuality(1, 1, getQualityProfile('high'))).toBe(false);
  });

  it('requests a renderer resize when the quality cap changes the effective pixel ratio', () => {
    expect(shouldResizeRendererForQuality(2, 2, getQualityProfile('low'))).toBe(true);
    expect(shouldResizeRendererForQuality(1, 2, getQualityProfile('high'))).toBe(true);
  });
});
