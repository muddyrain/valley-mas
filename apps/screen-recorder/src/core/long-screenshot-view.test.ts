import { describe, expect, it } from 'vitest';
import { getLongScreenshotSelectionFrame } from './long-screenshot-view';

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
