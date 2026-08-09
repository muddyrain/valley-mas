import { describe, expect, it, vi } from 'vitest';
import {
  calculateImageResizeDimensions,
  createImageTransformPlan,
  createUploadKey,
  exportImageToDataUrl,
  getBrowserImageToolManifest,
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

  it('creates a clamped crop, resize, rotation, and flip plan', () => {
    expect(
      createImageTransformPlan(
        { width: 1200, height: 800 },
        {
          crop: { x: 100, y: 50, width: 1000, height: 600 },
          width: 500,
          rotateDegrees: 90,
          flipHorizontal: true,
        },
      ),
    ).toEqual({
      source: { x: 100, y: 50, width: 1000, height: 600 },
      drawWidth: 500,
      drawHeight: 300,
      outputWidth: 300,
      outputHeight: 500,
      rotateDegrees: 90,
      flipHorizontal: true,
      flipVertical: false,
    });
  });

  it('supports cover resize by cropping the source to the target aspect ratio', () => {
    expect(
      createImageTransformPlan(
        { width: 1600, height: 900 },
        { width: 400, height: 400, fit: 'cover' },
      ),
    ).toMatchObject({
      source: { x: 350, y: 0, width: 900, height: 900 },
      drawWidth: 400,
      drawHeight: 400,
      outputWidth: 400,
      outputHeight: 400,
    });
  });

  it('exposes a serializable image transform manifest for tool hosts', () => {
    const manifest = getBrowserImageToolManifest();

    expect(manifest.name).toBe('image.transform');
    expect(manifest.operations).toContain('crop');
    expect(manifest.operations).toContain('watermark');
    expect(manifest.inputSchema.properties).toHaveProperty('options');
    expect(manifest.inputSchema.properties).not.toHaveProperty('crop');
    expect(() => JSON.stringify(manifest)).not.toThrow();
  });

  it('applies rounded clipping and a text watermark to the output canvas', () => {
    const context = {
      save: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      fillRect: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toDataURL: vi.fn(() => 'data:image/png;base64,output'),
    } as unknown as HTMLCanvasElement;
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement: vi.fn(() => canvas) },
    });

    try {
      expect(
        exportImageToDataUrl(
          { width: 100, height: 80 } as Parameters<typeof exportImageToDataUrl>[0],
          {
            mimeType: 'image/png',
            cornerRadius: 12,
            watermark: { text: 'Valley', position: 'bottom-right' },
          },
        ),
      ).toEqual({ url: 'data:image/png;base64,output', width: 100, height: 80 });
      expect(context.clip).toHaveBeenCalledTimes(2);
      expect(context.drawImage).toHaveBeenCalledOnce();
      expect(context.fillText).toHaveBeenCalledWith('Valley', 0, 0, 80);
    } finally {
      if (previousDocument) {
        Object.defineProperty(globalThis, 'document', previousDocument);
      } else {
        Reflect.deleteProperty(globalThis, 'document');
      }
    }
  });
});
