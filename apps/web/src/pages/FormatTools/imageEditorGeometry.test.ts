import { describe, expect, it } from 'vitest';
import { createInsetCrop, moveCropRect, resizeCropRect } from './imageEditorGeometry';

describe('image editor geometry', () => {
  it('creates a centered crop with room to move in every direction', () => {
    expect(createInsetCrop({ width: 136, height: 148 })).toEqual({
      x: 14,
      y: 15,
      width: 109,
      height: 118,
    });
  });

  it('moves a crop and clamps it inside the source image', () => {
    const crop = { x: 14, y: 15, width: 109, height: 118 };
    const bounds = { width: 136, height: 148 };

    expect(moveCropRect(crop, 8, 10, bounds)).toEqual({
      x: 22,
      y: 25,
      width: 109,
      height: 118,
    });
    expect(moveCropRect(crop, 100, 100, bounds)).toEqual({
      x: 27,
      y: 30,
      width: 109,
      height: 118,
    });
  });

  it('resizes from every edge instead of only the bottom-right corner', () => {
    const crop = { x: 20, y: 20, width: 60, height: 70 };
    const bounds = { width: 136, height: 148 };

    expect(resizeCropRect(crop, 'north-west', -10, -5, bounds)).toEqual({
      x: 10,
      y: 15,
      width: 70,
      height: 75,
    });
    expect(resizeCropRect(crop, 'east', 24, 0, bounds)).toEqual({
      x: 20,
      y: 20,
      width: 84,
      height: 70,
    });
  });
});
