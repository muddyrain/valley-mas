import { describe, expect, it } from 'vitest';
import { shouldHandleGlobalShortcut } from './global-shortcut';

describe('global shortcut activation', () => {
  it('keeps capture shortcuts active while the settings window is visible', () => {
    expect(
      shouldHandleGlobalShortcut({ settingsVisible: true, shortcutCaptureActive: false }),
    ).toBe(true);
  });

  it('does not run capture actions while a shortcut field is listening', () => {
    expect(
      shouldHandleGlobalShortcut({ settingsVisible: false, shortcutCaptureActive: true }),
    ).toBe(false);
  });

  it('runs when the settings window is hidden and no shortcut field is listening', () => {
    expect(
      shouldHandleGlobalShortcut({ settingsVisible: false, shortcutCaptureActive: false }),
    ).toBe(true);
  });
});
