import type { Rectangle } from './geometry';

export type PinnedScreenshotMenuHandlers = {
  copy: () => void;
  download: () => void;
  close: () => void;
};

export type PinnedScreenshotMenuAction = 'copy' | 'download' | 'close';

const PINNED_SCREENSHOT_MENU_WIDTH_SPACER = '　'.repeat(4);

export function getPinnedScreenshotMenuDisplayLabel(label: string): string {
  return `${label}${PINNED_SCREENSHOT_MENU_WIDTH_SPACER}`;
}

export type PinnedScreenshotMenuIconBitmap = {
  data: Uint8Array;
  width: number;
  height: number;
  scaleFactor: number;
};

function drawBitmapLine(
  data: Uint8Array,
  size: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number,
): void {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const radiusSquared = (width / 2) ** 2;
  const minimumX = Math.max(0, Math.floor(Math.min(startX, endX) - width));
  const maximumX = Math.min(size - 1, Math.ceil(Math.max(startX, endX) + width));
  const minimumY = Math.max(0, Math.floor(Math.min(startY, endY) - width));
  const maximumY = Math.min(size - 1, Math.ceil(Math.max(startY, endY) + width));

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const pixelX = x + 0.5;
      const pixelY = y + 0.5;
      const progress =
        lengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((pixelX - startX) * deltaX + (pixelY - startY) * deltaY) / lengthSquared,
              ),
            );
      const distanceX = pixelX - (startX + progress * deltaX);
      const distanceY = pixelY - (startY + progress * deltaY);
      if (distanceX * distanceX + distanceY * distanceY > radiusSquared) continue;
      const offset = (y * size + x) * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    }
  }
}

export function createPinnedScreenshotMenuIconBitmap(
  action: PinnedScreenshotMenuAction,
): PinnedScreenshotMenuIconBitmap {
  const scaleFactor = 2;
  const width = 32;
  const height = 32;
  const data = new Uint8Array(width * height * 4);
  const drawLine = (startX: number, startY: number, endX: number, endY: number) =>
    drawBitmapLine(
      data,
      width,
      startX * scaleFactor,
      startY * scaleFactor,
      endX * scaleFactor,
      endY * scaleFactor,
      1.5 * scaleFactor,
    );
  const drawRectangle = (left: number, top: number, right: number, bottom: number) => {
    drawLine(left, top, right, top);
    drawLine(right, top, right, bottom);
    drawLine(right, bottom, left, bottom);
    drawLine(left, bottom, left, top);
  };

  if (action === 'copy') {
    drawRectangle(3.5, 3.5, 10, 10);
    drawRectangle(6, 6, 12.5, 12.5);
  } else if (action === 'download') {
    drawLine(8, 2.75, 8, 10);
    drawLine(4.75, 7.25, 8, 10.5);
    drawLine(8, 10.5, 11.25, 7.25);
    drawLine(3.5, 13, 12.5, 13);
  } else {
    drawLine(4, 4, 12, 12);
    drawLine(12, 4, 4, 12);
  }

  return { data, width, height, scaleFactor };
}

export function tryCreatePinnedScreenshotMenuIcon<T>(
  action: PinnedScreenshotMenuAction,
  create: (action: PinnedScreenshotMenuAction) => T,
): T | undefined {
  try {
    return create(action);
  } catch {
    return undefined;
  }
}

export type PinnedScreenshotMenuItem =
  | {
      type: 'normal';
      action: PinnedScreenshotMenuAction;
      label: string;
      click: () => void;
    }
  | { type: 'separator' };

export function createPinnedScreenshotMenuItems(
  handlers: PinnedScreenshotMenuHandlers,
): PinnedScreenshotMenuItem[] {
  return [
    { type: 'normal', action: 'copy', label: '复制', click: handlers.copy },
    {
      type: 'normal',
      action: 'download',
      label: '下载',
      click: handlers.download,
    },
    { type: 'separator' },
    { type: 'normal', action: 'close', label: '关闭', click: handlers.close },
  ];
}

export function getPinnedScreenshotBounds(
  selection: Rectangle,
  displayBounds: Rectangle,
): Rectangle {
  if (
    ![selection.x, selection.y, selection.width, selection.height].every(Number.isFinite) ||
    selection.width < 1 ||
    selection.height < 1 ||
    displayBounds.width < 1 ||
    displayBounds.height < 1
  ) {
    throw new Error('固定图片尺寸无效');
  }
  if (selection.width > displayBounds.width || selection.height > displayBounds.height) {
    throw new Error('固定图片尺寸超出显示器范围');
  }
  const maximumX = displayBounds.x + displayBounds.width - selection.width;
  const maximumY = displayBounds.y + displayBounds.height - selection.height;
  return {
    x: Math.max(displayBounds.x, Math.min(selection.x, maximumX)),
    y: Math.max(displayBounds.y, Math.min(selection.y, maximumY)),
    width: selection.width,
    height: selection.height,
  };
}

export function getPinnedScreenshotWindowBounds(
  selection: Rectangle,
  displayBounds: Rectangle,
  inset: number,
): { image: Rectangle; window: Rectangle } {
  if (!Number.isFinite(inset) || inset < 0) throw new Error('固定图片边距无效');
  const imageBounds = getPinnedScreenshotBounds(selection, displayBounds);
  return {
    image: imageBounds,
    window: {
      x: imageBounds.x - inset,
      y: imageBounds.y - inset,
      width: imageBounds.width + inset * 2,
      height: imageBounds.height + inset * 2,
    },
  };
}
