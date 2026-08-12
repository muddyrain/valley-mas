import { describe, expect, it } from 'vitest';
import {
  createPixelCamera,
  PIXEL_ZOOM_STEPS,
  screenToWorldCell,
  terrainSourcePixels,
  zoomCameraAt,
} from './pixelCamera';

describe('pixel camera', () => {
  it('uses the approved stepped zoom levels and keeps the pointer anchor stable', () => {
    expect(PIXEL_ZOOM_STEPS).toEqual([0.5, 0.75, 1, 1.5, 2, 3, 4]);
    const camera = createPixelCamera(256, 1, 1280, 720);
    const before = screenToWorldCell(camera, 900, 420);
    const zoomed = zoomCameraAt(camera, 900, 420, 1);
    const after = screenToWorldCell(zoomed, 900, 420);

    expect(zoomed.zoom).toBe(1.5);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.z).toBeCloseTo(before.z, 5);
  });

  it('clamps panning so a finite island cannot be lost outside the viewport', () => {
    const camera = createPixelCamera(128, 4, 1200, 800);
    const moved = { ...camera, centerX: -999, centerZ: 999 };
    const clamped = zoomCameraAt(moved, 600, 400, 0);

    expect(clamped.centerX).toBeGreaterThanOrEqual(0);
    expect(clamped.centerX).toBeLessThanOrEqual(128);
    expect(clamped.centerZ).toBeGreaterThanOrEqual(0);
    expect(clamped.centerZ).toBeLessThanOrEqual(128);
  });

  it('uses a pre-scaled overview texture to avoid nearest-neighbour striping below 1x', () => {
    expect(terrainSourcePixels(0.5)).toBe(1);
    expect(terrainSourcePixels(0.75)).toBe(1);
    expect(terrainSourcePixels(1)).toBe(4);
    expect(terrainSourcePixels(4)).toBe(4);
  });
});
