import { describe, expect, it } from 'vitest';
import { getAlwaysOnTopRelativeLevel, getDisplayOverlayWindowOptions } from './overlay-window';

describe('display overlay window options', () => {
  it('allows a macOS overlay to cover and receive the first click above the work area', () => {
    expect(getDisplayOverlayWindowOptions('darwin')).toEqual({
      acceptFirstMouse: true,
      enableLargerThanScreen: true,
      roundedCorners: false,
    });
  });

  it('does not add macOS-only options on Windows', () => {
    expect(getDisplayOverlayWindowOptions('win32')).toEqual({});
  });

  it('keeps the capture overlay above pinned screenshots', () => {
    expect(getAlwaysOnTopRelativeLevel('capture-overlay')).toBeGreaterThan(
      getAlwaysOnTopRelativeLevel('pinned-screenshot'),
    );
  });
});
