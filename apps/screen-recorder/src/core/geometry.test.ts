import { describe, expect, it } from 'vitest';
import {
  clampRectToBounds,
  dipRectToVideoPixels,
  findDisplayForPoint,
  matchDisplaySource,
  normalizeSelection,
  validateSelection,
} from './geometry';

describe('selection geometry', () => {
  it('normalizes forward and reverse drags to the same rectangle', () => {
    const expected = { x: 40, y: 30, width: 160, height: 100 };
    expect(normalizeSelection({ x: 40, y: 30 }, { x: 200, y: 130 })).toEqual(expected);
    expect(normalizeSelection({ x: 200, y: 130 }, { x: 40, y: 30 })).toEqual(expected);
  });

  it('matches a display and source with negative desktop coordinates', () => {
    const displays = [
      { id: 'primary', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
      { id: 'left', bounds: { x: -1600, y: -200, width: 1600, height: 900 }, scaleFactor: 1.25 },
    ];
    const display = findDisplayForPoint(displays, { x: -800, y: 100 });
    expect(display?.id).toBe('left');
    expect(
      matchDisplaySource(
        [
          { id: 'screen:1', displayId: 'primary' },
          { id: 'screen:2', displayId: 'left' },
        ],
        displays[1],
      )?.id,
    ).toBe('screen:2');
  });

  it('uses actual video dimensions instead of assuming the display scale factor', () => {
    const display = {
      id: 'left',
      bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1.25,
    };
    expect(
      dipRectToVideoPixels({ x: -1824, y: 54, width: 960, height: 540 }, display, {
        width: 2560,
        height: 1440,
      }),
    ).toEqual({ x: 128, y: 72, width: 1280, height: 720 });
  });

  it('clips a selection to its display before conversion', () => {
    const bounds = { x: -1920, y: 0, width: 1920, height: 1080 };
    const display = { id: 'left', bounds, scaleFactor: 1.5 };
    const clipped = clampRectToBounds({ x: -2100, y: -100, width: 2300, height: 1300 }, bounds);
    expect(clipped).toEqual(bounds);
    expect(dipRectToVideoPixels(clipped, display, { width: 2880, height: 1620 })).toEqual({
      x: 0,
      y: 0,
      width: 2880,
      height: 1620,
    });
  });

  it('rejects zero-sized and overly small selections', () => {
    expect(() => validateSelection({ x: 0, y: 0, width: 0, height: 30 })).toThrow(
      '选区至少需要 16 × 16 DIP',
    );
    expect(() => validateSelection({ x: 0, y: 0, width: 15, height: 15 })).toThrow(
      '选区至少需要 16 × 16 DIP',
    );
  });
});
