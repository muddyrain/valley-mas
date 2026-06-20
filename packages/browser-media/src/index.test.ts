import { describe, expect, it } from 'vitest';
import {
  calculateImageResizeDimensions,
  createUploadKey,
  getOutputFileName,
  limitFiles,
  shouldCompressImageFile,
} from './index';

describe('browser media utilities', () => {
  it('limits accepted files to the remaining slots', () => {
    const files = Array.from({ length: 12 }, (_, index) => ({ name: `image-${index}.png` }));

    const result = limitFiles(files, 3, 10);

    expect(result.accepted).toHaveLength(7);
    expect(result.remainingSlots).toBe(7);
    expect(result.rejectedCount).toBe(5);
    expect(result.exceededLimit).toBe(true);
    expect(result.alreadyAtLimit).toBe(false);
  });

  it('reports when a file list is already full', () => {
    const result = limitFiles([{ name: 'extra.png' }], 10, 10);

    expect(result.accepted).toEqual([]);
    expect(result.remainingSlots).toBe(0);
    expect(result.rejectedCount).toBe(1);
    expect(result.exceededLimit).toBe(true);
    expect(result.alreadyAtLimit).toBe(true);
  });

  it('calculates resize dimensions without upscaling', () => {
    expect(
      calculateImageResizeDimensions({
        sourceWidth: 4000,
        sourceHeight: 2000,
        maxDimension: 1600,
      }),
    ).toEqual({ width: 1600, height: 800, scale: 0.4 });

    expect(
      calculateImageResizeDimensions({
        sourceWidth: 400,
        sourceHeight: 200,
        maxDimension: 1600,
      }),
    ).toEqual({ width: 400, height: 200, scale: 1 });
  });

  it('calculates target-width resize dimensions', () => {
    expect(
      calculateImageResizeDimensions({
        sourceWidth: 4000,
        sourceHeight: 2000,
        targetWidth: 1000,
      }),
    ).toEqual({ width: 1000, height: 500, scale: 0.25 });
  });

  it('creates output file names from requested mime type', () => {
    expect(getOutputFileName('photo.png', 'image/jpeg')).toBe('photo.jpg');
    expect(getOutputFileName('photo.old.png', 'image/webp')).toBe('photo.old.webp');
    expect(getOutputFileName('', 'image/png')).toBe('image.png');
  });

  it('creates upload keys with injectable randomness', () => {
    expect(createUploadKey({ randomUUID: () => 'fixed-id' })).toBe('fixed-id');
    expect(createUploadKey({ now: () => 1000, random: () => 0.5 })).toBe('upload-1000-80000000');
  });

  it('decides whether image files should be compressed', () => {
    expect(shouldCompressImageFile({ type: 'image/jpeg', size: 1_000_000 })).toBe(true);
    expect(shouldCompressImageFile({ type: 'image/gif', size: 1_000_000 })).toBe(false);
    expect(shouldCompressImageFile({ type: 'text/plain', size: 1_000_000 })).toBe(false);
    expect(shouldCompressImageFile({ type: 'image/png', size: 1000 })).toBe(false);
  });
});
