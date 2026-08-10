import { describe, expect, it } from 'vitest';
import {
  type BitmapFrame,
  composeLongScreenshot,
  detectVerticalShift,
  extractAppendedFrame,
  getVerticalShiftSearchStep,
  type LongScreenshotSlice,
} from './long-screenshot';

function frame(rows: number[]): BitmapFrame {
  const data = new Uint8Array(rows.length * 2 * 4);
  rows.forEach((value, y) => {
    for (let x = 0; x < 2; x += 1) {
      const offset = (y * 2 + x) * 4;
      data.set([value, value, value, 255], offset);
    }
  });
  return { width: 2, height: rows.length, data };
}

describe('long screenshot stitching', () => {
  it('detects duplicates and downward scroll overlap', () => {
    const first = frame([10, 20, 30, 40, 50, 60]);
    expect(detectVerticalShift(first, first)).toEqual({ shift: 0, score: 0 });
    expect(detectVerticalShift(first, frame([30, 40, 50, 60, 70, 80]))?.shift).toBe(2);
  });

  it('composes only the newly revealed rows', () => {
    const slices: LongScreenshotSlice[] = [
      { frame: frame([10, 20, 30, 40]), appendRows: 4 },
      { frame: frame([30, 40, 50, 60]), appendRows: 2 },
      { frame: frame([50, 60, 70, 80]), appendRows: 2 },
    ];
    const result = composeLongScreenshot(slices);

    expect(result.width).toBe(2);
    expect(result.height).toBe(8);
    expect(
      Array.from({ length: result.height }, (_, y) => result.data[y * result.width * 4]),
    ).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('stores only appended rows and bounds the coarse shift search for tall selections', () => {
    const appended = extractAppendedFrame(frame([10, 20, 30, 40]), 2);
    expect(appended.height).toBe(2);
    expect(Array.from(appended.data.filter((_, index) => index % 8 === 0))).toEqual([30, 40]);
    expect(getVerticalShiftSearchStep(100)).toBe(1);
    expect(Math.ceil(1_000 / getVerticalShiftSearchStep(1_000))).toBeLessThanOrEqual(100);
  });

  it('rejects incompatible frames and excessive output height', () => {
    expect(() =>
      composeLongScreenshot([
        { frame: frame([10, 20]), appendRows: 2 },
        { frame: { ...frame([20, 30]), width: 3 }, appendRows: 1 },
      ]),
    ).toThrow('尺寸');
    expect(() => composeLongScreenshot([{ frame: frame([10, 20]), appendRows: 30_001 }])).toThrow(
      '过长',
    );
  });
});
