import { describe, expect, it } from 'vitest';
import { getPinnedScreenshotBounds, getPinnedScreenshotWindowBounds } from './pinned-screenshot';

describe('pinned screenshot window bounds', () => {
  it('preserves image ratio, caps large images, and keeps the pin inside the work area', () => {
    expect(
      getPinnedScreenshotBounds(
        { width: 2400, height: 1200 },
        { x: -1920, y: 0, width: 1920, height: 1040 },
      ),
    ).toEqual({ x: -1512, y: 244, width: 1104, height: 552 });
  });

  it('does not upscale a small screenshot', () => {
    expect(
      getPinnedScreenshotBounds(
        { width: 320, height: 180 },
        { x: 0, y: 0, width: 1920, height: 1040 },
      ),
    ).toEqual({ x: 800, y: 430, width: 320, height: 180 });
  });

  it('reserves transparent space around the image so its border shadow is not clipped', () => {
    expect(
      getPinnedScreenshotWindowBounds(
        { width: 320, height: 180 },
        { x: 0, y: 0, width: 1920, height: 1040 },
        12,
      ),
    ).toEqual({
      image: { x: 800, y: 430, width: 320, height: 180 },
      window: { x: 788, y: 418, width: 344, height: 204 },
    });
  });
});
