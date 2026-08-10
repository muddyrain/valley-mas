import { describe, expect, it } from 'vitest';
import { getScreenshotToolbarPosition } from './screenshot-toolbar';

describe('screenshot toolbar position', () => {
  it('aligns the toolbar to the right edge of a lower-right selection', () => {
    expect(
      getScreenshotToolbarPosition(
        { x: 900, y: 700, width: 400, height: 180 },
        { width: 1440, height: 900 },
      ),
    ).toEqual({ left: 689, top: 640 });
  });

  it('keeps the right-aligned toolbar inside the viewport', () => {
    expect(
      getScreenshotToolbarPosition(
        { x: 1_300, y: 80, width: 300, height: 200 },
        { width: 1440, height: 900 },
      ),
    ).toEqual({ left: 817, top: 292 });
  });
});
