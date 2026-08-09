import { describe, expect, it } from 'vitest';
import { createSelectionMaskRects } from './selection-mask';

describe('createSelectionMaskRects', () => {
  const bounds = { x: 0, y: 0, width: 1920, height: 1080 };

  it('uses one lightweight full-screen mask before selection starts', () => {
    expect(createSelectionMaskRects(bounds)).toEqual([bounds]);
  });

  it('splits the dimmed area into four rectangles without covering the selection', () => {
    expect(createSelectionMaskRects(bounds, { x: 320, y: 180, width: 960, height: 540 })).toEqual([
      { x: 0, y: 0, width: 1920, height: 180 },
      { x: 0, y: 180, width: 320, height: 540 },
      { x: 1280, y: 180, width: 640, height: 540 },
      { x: 0, y: 720, width: 1920, height: 360 },
    ]);
  });

  it('clips a selection that reaches outside the display bounds', () => {
    expect(createSelectionMaskRects(bounds, { x: -40, y: 900, width: 2200, height: 300 })).toEqual([
      { x: 0, y: 0, width: 1920, height: 900 },
    ]);
  });
});
