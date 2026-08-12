import { describe, expect, it } from 'vitest';

import {
  buildMacOSLongScreenshotCaptureArgs,
  parseMacOSLongScreenshotCapture,
  parseMediaSourceWindowId,
  shouldUseNativeMacOSLongScreenshotCapture,
} from './macos-long-screenshot-capture';

describe('macOS long screenshot capture', () => {
  it('uses ScreenCaptureKit screenshots only on macOS 14 or newer', () => {
    expect(shouldUseNativeMacOSLongScreenshotCapture('darwin', '15.6.1')).toBe(true);
    expect(shouldUseNativeMacOSLongScreenshotCapture('darwin', '14.0.0')).toBe(true);
    expect(shouldUseNativeMacOSLongScreenshotCapture('darwin', '13.7.8')).toBe(false);
    expect(shouldUseNativeMacOSLongScreenshotCapture('win32', '15.6.1')).toBe(false);
    expect(shouldUseNativeMacOSLongScreenshotCapture('darwin', 'unknown')).toBe(false);
  });

  it('extracts the native window id from an Electron media source id', () => {
    expect(parseMediaSourceWindowId('window:318:0')).toBe('318');
    expect(parseMediaSourceWindowId('screen:1:0')).toBeUndefined();
    expect(parseMediaSourceWindowId('window:not-a-number:0')).toBeUndefined();
  });

  it('builds a selection-only ScreenCaptureKit request with excluded overlay windows', () => {
    expect(
      buildMacOSLongScreenshotCaptureArgs({
        displayId: 697_333_778,
        displayBounds: { x: -1728, y: 0, width: 1728, height: 1117 },
        selection: { x: -1600, y: 84, width: 400, height: 420 },
        pixelSize: { width: 800, height: 840 },
        excludedWindowIds: ['318', '322'],
      }),
    ).toEqual(['capture', '697333778', '318,322', '128', '84', '400', '420', '800', '840']);
  });

  it('decodes successful PNG output and surfaces native capture failures', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(parseMacOSLongScreenshotCapture(png.toString('base64'))).toEqual(png);
    expect(() => parseMacOSLongScreenshotCapture('error:无法读取目标显示器')).toThrow(
      '无法读取目标显示器',
    );
  });
});
