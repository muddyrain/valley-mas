import { describe, expect, it } from 'vitest';
import {
  dampCurlActivity,
  resolveAnimatedStickerCount,
  resolveCurlTarget,
  resolveFluidActivity,
  resolveHeroExitProgress,
} from './stageMotion';

describe('stageMotion', () => {
  it('maps the first 0.75 viewport of scroll to a reversible hero exit progress', () => {
    expect(resolveHeroExitProgress(0, 800)).toBe(0);
    expect(resolveHeroExitProgress(300, 800)).toBe(0.5);
    expect(resolveHeroExitProgress(600, 800)).toBe(1);
    expect(resolveHeroExitProgress(900, 800)).toBe(1);
    expect(resolveHeroExitProgress(100, 0)).toBe(0);
  });

  it('keeps fluid activity alive for 600ms after the last pointer movement', () => {
    expect(resolveFluidActivity(true, 1_000, 1_000)).toBe(1);
    expect(resolveFluidActivity(true, 1_000, 1_300)).toBe(0.5);
    expect(resolveFluidActivity(true, 1_000, 1_600)).toBe(0);
    expect(resolveFluidActivity(false, 1_000, 1_100)).toBe(0);
  });

  it('uses scroll speed magnitude with a faster attack than release', () => {
    expect(resolveCurlTarget(-400)).toBe(0.5);
    expect(resolveCurlTarget(1_600)).toBe(1);

    const attacked = dampCurlActivity(0, 1, 0.025);
    const released = dampCurlActivity(1, 0, 0.025);
    expect(attacked).toBeGreaterThan(0.6);
    expect(released).toBeGreaterThan(0.8);
  });

  it('limits animated sticker entrances by performance tier', () => {
    expect(resolveAnimatedStickerCount('full')).toBe(6);
    expect(resolveAnimatedStickerCount('balanced')).toBe(3);
    expect(resolveAnimatedStickerCount('static')).toBe(0);
  });
});
