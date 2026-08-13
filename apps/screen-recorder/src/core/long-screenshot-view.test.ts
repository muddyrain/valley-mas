import { describe, expect, it } from 'vitest';
import {
  getLongScreenshotControlBoundsForContent,
  getLongScreenshotControlLayout,
  getLongScreenshotPreviewSize,
  getLongScreenshotSelectionFrame,
} from './long-screenshot-view';

describe('long screenshot selection frame', () => {
  it('maps a global selection into a negative-coordinate display window', () => {
    expect(
      getLongScreenshotSelectionFrame(
        { x: -1920, y: -120, width: 1920, height: 1080 },
        { x: -1720, y: 30, width: 640, height: 420 },
      ),
    ).toEqual({ x: 200, y: 150, width: 640, height: 420 });
  });
});

describe('long screenshot control layout', () => {
  it('places the preview group on the right when the full group fits', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: 0, y: 0, width: 1440, height: 900 },
        { x: 80, y: 60, width: 960, height: 720 },
      ),
    ).toEqual({
      placement: 'right',
      bounds: { x: 1052, y: 506, width: 280, height: 274 },
    });
  });

  it('uses the left side when the right side is too narrow', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: 0, y: 0, width: 1440, height: 900 },
        { x: 400, y: 80, width: 900, height: 680 },
      ),
    ).toEqual({
      placement: 'left',
      bounds: { x: 108, y: 485, width: 280, height: 275 },
    });
  });

  it('keeps right-side priority even when the left side has more room', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: 0, y: 0, width: 1440, height: 900 },
        { x: 400, y: 100, width: 700, height: 400 },
      ),
    ).toEqual({
      placement: 'right',
      bounds: { x: 1112, y: 274, width: 280, height: 226 },
    });
  });

  it('sizes a wide selection to its scaled preview instead of leaving a white half-window', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: 0, y: 0, width: 2560, height: 1440 },
        { x: 266, y: 357, width: 789, height: 398 },
      ),
    ).toEqual({
      placement: 'right',
      bounds: { x: 1067, y: 546, width: 280, height: 209 },
    });
  });

  it('uses the actual first frame aspect ratio for the initial window bounds', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: 0, y: 0, width: 2560, height: 1440 },
        { x: 266, y: 357, width: 789, height: 398 },
        { width: 1578, height: 1200 },
      ),
    ).toEqual({
      placement: 'right',
      bounds: { x: 1067, y: 478, width: 280, height: 277 },
    });
  });

  it('grows a side preview upward until it reaches the selection height', () => {
    const workArea = { x: 0, y: 0, width: 2560, height: 1440 };
    const selection = { x: 266, y: 357, width: 789, height: 398 };
    const initial = getLongScreenshotControlLayout(workArea, selection);

    expect(
      getLongScreenshotControlBoundsForContent(workArea, selection, initial, {
        width: 789,
        height: 900,
      }),
    ).toEqual({ x: 1067, y: 377, width: 280, height: 378 });
    expect(
      getLongScreenshotControlBoundsForContent(workArea, selection, initial, {
        width: 789,
        height: 1500,
      }),
    ).toEqual({ x: 1067, y: 357, width: 280, height: 398 });
  });

  it('places the preview below when neither side is usefully wide', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: 0, y: 0, width: 1000, height: 700 },
        { x: 130, y: 260, width: 740, height: 180 },
      ),
    ).toEqual({
      placement: 'bottom',
      bounds: { x: 590, y: 452, width: 280, height: 140 },
    });
  });

  it('places the preview above when the side and bottom strips are too small', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: 0, y: 0, width: 1000, height: 700 },
        { x: 130, y: 300, width: 740, height: 300 },
      ),
    ).toEqual({
      placement: 'top',
      bounds: { x: 590, y: 106, width: 280, height: 182 },
    });
  });

  it('supports displays with negative global coordinates', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: -1440, y: -60, width: 1440, height: 900 },
        { x: -1300, y: 20, width: 900, height: 520 },
      ),
    ).toEqual({
      placement: 'right',
      bounds: { x: -388, y: 312, width: 280, height: 228 },
    });
  });

  it('only overlays the selection bottom-right when every outside strip is too small', () => {
    expect(
      getLongScreenshotControlLayout(
        { x: 0, y: 0, width: 1000, height: 700 },
        { x: 20, y: 20, width: 960, height: 650 },
      ),
    ).toEqual({
      placement: 'corner',
      bounds: { x: 748, y: 444, width: 220, height: 214 },
    });
  });
});

describe('long screenshot preview resolution', () => {
  it('keeps enough source pixels without upscaling and preserves thin slices', () => {
    expect(getLongScreenshotPreviewSize(1920, 1080)).toEqual({ width: 512, height: 288 });
    expect(getLongScreenshotPreviewSize(320, 180)).toEqual({ width: 320, height: 180 });
    expect(getLongScreenshotPreviewSize(800, 1)).toEqual({ width: 512, height: 1 });
  });
});
