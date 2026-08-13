import type { Rectangle } from './geometry';

const CONTROL_MARGIN = 12;
const CONTROL_GAP = 12;
const CONTROL_PREFERRED_WIDTH = 280;
const CONTROL_MIN_WIDTH = 180;
const CONTROL_MIN_HEIGHT = 140;
const CONTROL_PREVIEW_INLINE_INSET = 14;
const CONTROL_VERTICAL_CHROME = 74;
const CORNER_CONTROL_WIDTH = 220;
const PREVIEW_PIXEL_WIDTH = 512;

export type LongScreenshotControlLayout = {
  placement: 'right' | 'left' | 'bottom' | 'top' | 'corner';
  bounds: Rectangle;
};

type Size = { width: number; height: number };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function intersect(first: Rectangle, second: Rectangle): Rectangle | undefined {
  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  if (right <= x || bottom <= y) return undefined;
  return { x, y, width: right - x, height: bottom - y };
}

function getControlHeight(width: number, content: Size): number {
  const previewWidth = Math.max(1, width - CONTROL_PREVIEW_INLINE_INSET);
  const previewHeight = Math.ceil(
    (Math.max(1, content.height) * previewWidth) / Math.max(1, content.width),
  );
  return Math.max(previewHeight + CONTROL_VERTICAL_CHROME, CONTROL_MIN_HEIGHT);
}

function getSafeArea(workArea: Rectangle): Rectangle {
  return {
    x: workArea.x + CONTROL_MARGIN,
    y: workArea.y + CONTROL_MARGIN,
    width: Math.max(1, workArea.width - CONTROL_MARGIN * 2),
    height: Math.max(1, workArea.height - CONTROL_MARGIN * 2),
  };
}

function getSideControlY(safeArea: Rectangle, selection: Rectangle, height: number): number {
  const safeBottom = safeArea.y + safeArea.height;
  const anchoredBottom = clamp(selection.y + selection.height, safeArea.y + height, safeBottom);
  return anchoredBottom - height;
}

export function getLongScreenshotControlLayout(
  workArea: Rectangle,
  selection: Rectangle,
  initialContent: Size = selection,
): LongScreenshotControlLayout {
  const safeArea = getSafeArea(workArea);
  const safeRight = safeArea.x + safeArea.width;
  const safeBottom = safeArea.y + safeArea.height;
  const sideMaximumHeight = Math.min(
    safeArea.height,
    Math.max(CONTROL_MIN_HEIGHT, selection.height),
  );
  const rightX = selection.x + selection.width + CONTROL_GAP;
  const rightWidth = Math.min(CONTROL_PREFERRED_WIDTH, safeRight - rightX);
  const rightHeight = Math.min(getControlHeight(rightWidth, initialContent), sideMaximumHeight);
  if (rightWidth >= CONTROL_MIN_WIDTH && rightHeight >= CONTROL_MIN_HEIGHT) {
    return {
      placement: 'right',
      bounds: {
        x: rightX,
        y: getSideControlY(safeArea, selection, rightHeight),
        width: rightWidth,
        height: rightHeight,
      },
    };
  }

  const leftSpace = selection.x - CONTROL_GAP - safeArea.x;
  const leftWidth = Math.min(CONTROL_PREFERRED_WIDTH, leftSpace);
  const leftHeight = Math.min(getControlHeight(leftWidth, initialContent), sideMaximumHeight);
  if (leftWidth >= CONTROL_MIN_WIDTH && leftHeight >= CONTROL_MIN_HEIGHT) {
    return {
      placement: 'left',
      bounds: {
        x: selection.x - CONTROL_GAP - leftWidth,
        y: getSideControlY(safeArea, selection, leftHeight),
        width: leftWidth,
        height: leftHeight,
      },
    };
  }

  const edgeWidth = Math.min(CONTROL_PREFERRED_WIDTH, safeArea.width);
  const edgeX = clamp(selection.x + selection.width - edgeWidth, safeArea.x, safeRight - edgeWidth);
  const edgeHeight = getControlHeight(edgeWidth, initialContent);
  const bottomY = selection.y + selection.height + CONTROL_GAP;
  const bottomHeight = Math.min(edgeHeight, safeBottom - bottomY);
  if (edgeWidth >= CONTROL_MIN_WIDTH && bottomHeight >= CONTROL_MIN_HEIGHT) {
    return {
      placement: 'bottom',
      bounds: { x: edgeX, y: bottomY, width: edgeWidth, height: bottomHeight },
    };
  }

  const topSpace = selection.y - CONTROL_GAP - safeArea.y;
  const topHeight = Math.min(edgeHeight, topSpace);
  if (edgeWidth >= CONTROL_MIN_WIDTH && topHeight >= CONTROL_MIN_HEIGHT) {
    return {
      placement: 'top',
      bounds: {
        x: edgeX,
        y: selection.y - CONTROL_GAP - topHeight,
        width: edgeWidth,
        height: topHeight,
      },
    };
  }

  const cornerArea = intersect(workArea, selection) ?? workArea;
  const cornerWidth = Math.max(
    1,
    Math.min(CORNER_CONTROL_WIDTH, cornerArea.width - CONTROL_MARGIN * 2),
  );
  const cornerHeight = Math.max(
    1,
    Math.min(getControlHeight(cornerWidth, initialContent), cornerArea.height - CONTROL_MARGIN * 2),
  );
  return {
    placement: 'corner',
    bounds: {
      x: cornerArea.x + cornerArea.width - CONTROL_MARGIN - cornerWidth,
      y: cornerArea.y + cornerArea.height - CONTROL_MARGIN - cornerHeight,
      width: cornerWidth,
      height: cornerHeight,
    },
  };
}

export function getLongScreenshotControlBoundsForContent(
  workArea: Rectangle,
  selection: Rectangle,
  layout: LongScreenshotControlLayout,
  content: Size,
): Rectangle {
  const safeArea = getSafeArea(workArea);
  const safeBottom = safeArea.y + safeArea.height;
  const desiredHeight = getControlHeight(layout.bounds.width, content);
  if (layout.placement === 'right' || layout.placement === 'left') {
    const maximumHeight = Math.min(safeArea.height, Math.max(CONTROL_MIN_HEIGHT, selection.height));
    const height = Math.min(desiredHeight, maximumHeight);
    return {
      ...layout.bounds,
      y: getSideControlY(safeArea, selection, height),
      height,
    };
  }
  if (layout.placement === 'bottom') {
    return {
      ...layout.bounds,
      height: Math.min(desiredHeight, safeBottom - layout.bounds.y),
    };
  }
  if (layout.placement === 'top') {
    const bottom = selection.y - CONTROL_GAP;
    const height = Math.min(desiredHeight, bottom - safeArea.y);
    return { ...layout.bounds, y: bottom - height, height };
  }
  const cornerArea = intersect(workArea, selection) ?? workArea;
  const height = Math.min(desiredHeight, cornerArea.height - CONTROL_MARGIN * 2);
  return {
    ...layout.bounds,
    y: cornerArea.y + cornerArea.height - CONTROL_MARGIN - height,
    height,
  };
}

export function getLongScreenshotPreviewSize(frameWidth: number, frameHeight: number): Size {
  const width = Math.min(PREVIEW_PIXEL_WIDTH, Math.max(1, Math.floor(frameWidth)));
  return {
    width,
    height: Math.max(1, Math.round((Math.max(1, frameHeight) * width) / Math.max(1, frameWidth))),
  };
}

export function getLongScreenshotSelectionFrame(
  displayBounds: Rectangle,
  selection: Rectangle,
): Rectangle {
  return {
    x: selection.x - displayBounds.x,
    y: selection.y - displayBounds.y,
    width: selection.width,
    height: selection.height,
  };
}
