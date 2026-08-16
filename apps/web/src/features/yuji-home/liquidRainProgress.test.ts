import { describe, expect, it } from 'vitest';
import { getLiquidRainFrame, normalizeLiquidRainPointer } from './liquidRainProgress';

describe('getLiquidRainFrame', () => {
  it('clamps progress and begins with a calm opaque membrane', () => {
    expect(getLiquidRainFrame(-1)).toEqual(getLiquidRainFrame(0));
    expect(getLiquidRainFrame(0)).toMatchObject({
      atmosphere: 0,
      imageVisibility: 0.2,
      progress: 0,
      portraitFrost: 0,
      scene: 'arrival',
      taglineOpacity: 1,
      transitionBridge: 0,
      portalProgress: 0,
    });
  });

  it('keeps a visible anchor and rain detail through the observatory scene', () => {
    const observatory = getLiquidRainFrame(0.3);

    expect(observatory.scene).toBe('arrival');
    expect(observatory.atmosphere).toBeGreaterThan(0.75);
    expect(observatory.imageVisibility).toBeGreaterThan(0.28);
    expect(observatory.taglineOpacity).toBeGreaterThan(0.35);
  });

  it('frosts the portrait before hiding the crossfade behind a liquid bridge', () => {
    const portrait = getLiquidRainFrame(0.56);
    const bridge = getLiquidRainFrame(0.75);

    expect(portrait.portraitFrost).toBeGreaterThan(0.8);
    expect(portrait.transitionBridge).toBe(0);
    expect(bridge.transitionBridge).toBeGreaterThan(0.9);
    expect(bridge.portalProgress).toBeLessThan(0.1);
  });

  it('moves through refraction before opening the two portals', () => {
    const refraction = getLiquidRainFrame(0.56);
    const portal = getLiquidRainFrame(0.88);

    expect(refraction.scene).toBe('refraction');
    expect(refraction.refraction).toBeGreaterThan(0.5);
    expect(refraction.portalProgress).toBe(0);
    expect(portal.scene).toBe('portal');
    expect(portal.portalProgress).toBeGreaterThan(0.5);
    expect(portal.taglineOpacity).toBe(0);
  });

  it('reaches a fully revealed and reversible final frame', () => {
    expect(getLiquidRainFrame(2)).toMatchObject({
      progress: 1,
      scene: 'portal',
      portalProgress: 1,
      paperReveal: 1,
      portraitFrost: 0,
      transitionBridge: 0,
    });
  });
});

describe('normalizeLiquidRainPointer', () => {
  it('maps pointer coordinates against the pinned canvas instead of the scrolling section', () => {
    const rect = { height: 500, left: 100, top: 50, width: 1000 };

    expect(normalizeLiquidRainPointer(600, 300, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizeLiquidRainPointer(-100, 900, rect)).toEqual({ x: 0, y: 0 });
  });
});
