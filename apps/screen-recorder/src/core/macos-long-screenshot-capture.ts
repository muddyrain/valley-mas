type Rectangle = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

export function shouldUseNativeMacOSLongScreenshotCapture(
  platform: NodeJS.Platform,
  systemVersion: string,
): boolean {
  if (platform !== 'darwin') return false;
  const majorVersion = Number.parseInt(systemVersion.split('.')[0] ?? '', 10);
  return Number.isFinite(majorVersion) && majorVersion >= 14;
}

export function parseMediaSourceWindowId(sourceId: string): string | undefined {
  const match = /^window:(\d+):\d+$/.exec(sourceId);
  return match?.[1];
}

export function buildMacOSLongScreenshotCaptureArgs(value: {
  displayId: number;
  displayBounds: Rectangle;
  selection: Rectangle;
  pixelSize: Size;
  excludedWindowIds: readonly string[];
}): string[] {
  const sourceX = value.selection.x - value.displayBounds.x;
  const sourceY = value.selection.y - value.displayBounds.y;
  return [
    'capture',
    String(value.displayId),
    value.excludedWindowIds.join(','),
    String(sourceX),
    String(sourceY),
    String(value.selection.width),
    String(value.selection.height),
    String(value.pixelSize.width),
    String(value.pixelSize.height),
  ];
}

export function parseMacOSLongScreenshotCapture(value: string): Buffer {
  const response = value.trim();
  if (response.startsWith('error:')) {
    throw new Error(response.slice('error:'.length) || 'macOS 长截图捕获失败');
  }
  const png = Buffer.from(response, 'base64');
  if (png.length < 4 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
    throw new Error('macOS 长截图捕获结果无效');
  }
  return png;
}
