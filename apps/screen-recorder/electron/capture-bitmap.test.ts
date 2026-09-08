import { describe, expect, it } from 'vitest';
import { encodeCaptureBitmap } from './capture-bitmap';

describe('lossless capture preview', () => {
  it('preserves BGRA colors and top-to-bottom rows without compression', () => {
    const pixels = Buffer.from([
      0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255, 255, 255, 255, 255,
    ]);
    const bitmap = encodeCaptureBitmap(pixels, { width: 2, height: 2 });
    expect(bitmap.toString('ascii', 0, 2)).toBe('BM');
    expect(bitmap.readUInt32LE(2)).toBe(bitmap.length);
    expect(bitmap.readInt32LE(18)).toBe(2);
    expect(bitmap.readInt32LE(22)).toBe(-2);
    expect(bitmap.readUInt16LE(28)).toBe(32);
    expect(bitmap.subarray(bitmap.readUInt32LE(10))).toEqual(pixels);
  });

  it('rejects truncated pixels and invalid dimensions', () => {
    expect(() => encodeCaptureBitmap(Buffer.alloc(4), { width: 2, height: 2 })).toThrow();
    expect(() => encodeCaptureBitmap(Buffer.alloc(0), { width: 0, height: 2 })).toThrow();
  });
});
