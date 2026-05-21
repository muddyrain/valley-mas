import { describe, expect, it } from 'vitest';
import {
  centerCameraView,
  clampCameraCenter,
  getAnchoredZoomCenter,
  getCameraDetailLevel,
  getCameraViewportFromCenter,
  getContainZoom,
  getCoverZoom,
  getViewportRelativePanSpeed,
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

  it('centers the camera on the world center', () => {
    const nextCenter = centerCameraView({
      viewportWidth: 1667,
      viewportHeight: 1233,
      worldWidth: 2560,
      worldHeight: 2560,
    });

    expect(nextCenter.centerX).toBe(1280);
    expect(nextCenter.centerY).toBe(1280);
  });

  it('clamps camera center so contained viewports do not expose map background', () => {
    const nextCenter = clampCameraCenter({
      centerX: 200,
      centerY: 2500,
      viewportWidth: 1667,
      viewportHeight: 1233,
      worldWidth: 2560,
      worldHeight: 2560,
    });

    expect(nextCenter.centerX).toBeCloseTo(833.5, 5);
    expect(nextCenter.centerY).toBeCloseTo(1943.5, 5);
  });

  it('centers oversized viewport axes on the world center', () => {
    const nextCenter = clampCameraCenter({
      centerX: -50,
      centerY: 20,
      viewportWidth: 1200,
      viewportHeight: 800,
      worldWidth: 1000,
      worldHeight: 1600,
    });

    expect(nextCenter.centerX).toBeCloseTo(500, 5);
    expect(nextCenter.centerY).toBeCloseTo(400, 5);
  });

  it('keeps the pointed world coordinate stable when zooming around a screen anchor', () => {
    const currentCenter = { centerX: 1280, centerY: 1280 };
    const screenAnchor = { screenX: 400, screenY: 600 };
    const beforeWorldX = currentCenter.centerX + (screenAnchor.screenX - 600) / 0.75;
    const beforeWorldY = currentCenter.centerY + (screenAnchor.screenY - 450) / 0.75;
    const nextCenter = getAnchoredZoomCenter({
      ...currentCenter,
      ...screenAnchor,
      viewportWidth: 1200,
      viewportHeight: 900,
      currentZoom: 0.75,
      nextZoom: 1.25,
    });
    const afterWorldX = nextCenter.centerX + (screenAnchor.screenX - 600) / 1.25;
    const afterWorldY = nextCenter.centerY + (screenAnchor.screenY - 450) / 1.25;

    expect(afterWorldX).toBeCloseTo(beforeWorldX, 5);
    expect(afterWorldY).toBeCloseTo(beforeWorldY, 5);
  });

  it('clamps around the center after zoom instead of stale scroll offsets', () => {
    const nextCenter = clampCameraCenter({
      centerX: -360,
      centerY: -140,
      viewportWidth: 3900,
      viewportHeight: 1846,
      worldWidth: 2560,
      worldHeight: 2560,
    });

    expect(nextCenter.centerX).toBeCloseTo(1280, 5);
    expect(nextCenter.centerY).toBeCloseTo(923, 5);
  });

  it('derives the visible viewport from the live camera center and zoom-sized view', () => {
    const viewport = getCameraViewportFromCenter({
      centerX: 1280,
      centerY: 900,
      viewportWidth: 1600,
      viewportHeight: 1000,
    });

    expect(viewport).toEqual({
      x: 480,
      y: 400,
      width: 1600,
      height: 1000,
    });
  });

  it('uses viewport-relative pan speed so perceived screen speed stays stable across zoom', () => {
    const screenWidth = 1200;
    const fraction = 0.7;
    const zoomedInZoom = 3;
    const zoomedOutZoom = 0.5;
    const zoomedInWorldSpeed = getViewportRelativePanSpeed({
      viewportWidth: screenWidth / zoomedInZoom,
      viewportHeight: 900 / zoomedInZoom,
      viewportFractionPerSecond: fraction,
    });
    const zoomedOutWorldSpeed = getViewportRelativePanSpeed({
      viewportWidth: screenWidth / zoomedOutZoom,
      viewportHeight: 900 / zoomedOutZoom,
      viewportFractionPerSecond: fraction,
    });

    expect(zoomedInWorldSpeed * zoomedInZoom).toBeCloseTo(screenWidth * fraction, 5);
    expect(zoomedOutWorldSpeed * zoomedOutZoom).toBeCloseTo(screenWidth * fraction, 5);
  });

  it('uses the larger viewport axis for diagonal-friendly pan speed', () => {
    const speed = getViewportRelativePanSpeed({
      viewportWidth: 1600,
      viewportHeight: 900,
      viewportFractionPerSecond: 0.5,
    });

    expect(speed).toBe(800);
  });

  it('maps zoom to WorldBox-style render detail levels', () => {
    expect(getCameraDetailLevel(0.6)).toBe('overview');
    expect(getCameraDetailLevel(1)).toBe('regional');
    expect(getCameraDetailLevel(1.6)).toBe('local');
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
