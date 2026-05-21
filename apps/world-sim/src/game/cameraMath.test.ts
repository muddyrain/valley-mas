import { describe, expect, it } from 'vitest';
import {
  centerCameraScroll,
  clampCameraScroll,
  getContainZoom,
  getCoverZoom,
  stepCameraMotion,
} from './cameraMath';

describe('cameraMath', () => {
  it('uses cover zoom for the default game camera view', () => {
    expect(getCoverZoom({ width: 1200, height: 888 }, { width: 2560, height: 2560 }, 3)).toBe(
      1200 / 2560,
    );
  });

  it('uses contain zoom for the maximum world overview', () => {
    expect(getContainZoom({ width: 1200, height: 888 }, { width: 2560, height: 2560 }, 3)).toBe(
      888 / 2560,
    );
  });

  it('centers the world view while preserving Phaser scroll offset', () => {
    const nextScroll = centerCameraScroll({
      scrollX: 218,
      scrollY: 157,
      screenWidth: 1200,
      screenHeight: 887,
      viewportWidth: 1667,
      viewportHeight: 1233,
      worldWidth: 2560,
      worldHeight: 2560,
    });

    expect(nextScroll.scrollX).toBeCloseTo((2560 - 1667) / 2 + 233.5, 5);
    expect(nextScroll.scrollY).toBeCloseTo((2560 - 1233) / 2 + 173, 5);
  });

  it('clamps a covered viewport so the camera background is not exposed', () => {
    const nextScroll = clampCameraScroll({
      scrollX: 218,
      scrollY: 157,
      screenWidth: 1200,
      screenHeight: 887,
      viewportWidth: 1667,
      viewportHeight: 1233,
      worldWidth: 2560,
      worldHeight: 2560,
    });

    expect(nextScroll.scrollX).toBeCloseTo(233.5, 5);
    expect(nextScroll.scrollY).toBeCloseTo(173, 5);
  });

  it('centers an oversized viewport on the smaller world axis', () => {
    const nextScroll = clampCameraScroll({
      scrollX: -50,
      scrollY: 20,
      screenWidth: 1200,
      screenHeight: 800,
      viewportWidth: 1200,
      viewportHeight: 800,
      worldWidth: 1000,
      worldHeight: 1600,
    });

    expect(nextScroll.scrollX).toBeCloseTo(-100, 5);
    expect(nextScroll.scrollY).toBeCloseTo(20, 5);
  });

  it('clamps from current scroll instead of stale cached worldView values after zoom', () => {
    const nextScroll = clampCameraScroll({
      scrollX: -360,
      scrollY: -140,
      screenWidth: 2048,
      screenHeight: 969,
      viewportWidth: 3900,
      viewportHeight: 1846,
      worldWidth: 2560,
      worldHeight: 2560,
    });

    expect(nextScroll.scrollX).toBeCloseTo(256, 5);
    expect(nextScroll.scrollY).toBeCloseTo(438.5, 5);
  });

  it('eases keyboard camera velocity instead of jumping directly to full speed', () => {
    const nextMotion = stepCameraMotion(
      { velocityX: 0, velocityY: 0 },
      {
        directionX: 1,
        directionY: 0,
        speed: 560,
        deltaSeconds: 1 / 60,
        acceleration: 18,
        deceleration: 24,
      },
    );

    expect(nextMotion.velocityX).toBeGreaterThan(0);
    expect(nextMotion.velocityX).toBeLessThan(560);
    expect(nextMotion.velocityY).toBe(0);
  });

  it('normalizes diagonal camera motion to the configured speed', () => {
    const nextMotion = stepCameraMotion(
      { velocityX: 0, velocityY: 0 },
      {
        directionX: 1,
        directionY: 1,
        speed: 560,
        deltaSeconds: 1,
        acceleration: 100,
        deceleration: 24,
      },
    );

    expect(Math.hypot(nextMotion.velocityX, nextMotion.velocityY)).toBeCloseTo(560, 5);
  });

  it('eases camera velocity back to rest after input stops', () => {
    const nextMotion = stepCameraMotion(
      { velocityX: 560, velocityY: 0 },
      {
        directionX: 0,
        directionY: 0,
        speed: 560,
        deltaSeconds: 1 / 60,
        acceleration: 18,
        deceleration: 24,
      },
    );

    expect(nextMotion.velocityX).toBeGreaterThan(0);
    expect(nextMotion.velocityX).toBeLessThan(560);
    expect(nextMotion.velocityY).toBe(0);
  });
});
