export type Point = { x: number; y: number };
export type Rectangle = { x: number; y: number; width: number; height: number };
export type DisplayGeometry = {
  id: string;
  bounds: Rectangle;
  scaleFactor: number;
};

export function normalizeSelection(start: Point, end: Point): Rectangle {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function clampRectToBounds(rect: Rectangle, bounds: Rectangle): Rectangle {
  const left = Math.max(rect.x, bounds.x);
  const top = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function validateSelection(rect: Rectangle, minimumSize = 16): Rectangle {
  if (
    ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
    rect.width < minimumSize ||
    rect.height < minimumSize
  ) {
    throw new Error(`选区至少需要 ${minimumSize} × ${minimumSize} DIP`);
  }
  return rect;
}

export function findDisplayForPoint(
  displays: readonly DisplayGeometry[],
  point: Point,
): DisplayGeometry | undefined {
  return displays.find(({ bounds }) => {
    return (
      point.x >= bounds.x &&
      point.x < bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y < bounds.y + bounds.height
    );
  });
}

export function matchDisplaySource<T extends { displayId: string }>(
  sources: readonly T[],
  display: DisplayGeometry,
): T | undefined {
  return sources.find((source) => source.displayId === String(display.id));
}

export function dipRectToVideoPixels(
  selection: Rectangle,
  display: DisplayGeometry,
  videoSize: { width: number; height: number },
): Rectangle {
  if (display.bounds.width <= 0 || display.bounds.height <= 0) {
    throw new Error('显示器尺寸无效');
  }
  if (videoSize.width <= 0 || videoSize.height <= 0) {
    throw new Error('捕获流尺寸无效');
  }

  const clipped = clampRectToBounds(selection, display.bounds);
  validateSelection(clipped);
  const scaleX = videoSize.width / display.bounds.width;
  const scaleY = videoSize.height / display.bounds.height;
  const left = Math.max(0, Math.floor((clipped.x - display.bounds.x) * scaleX));
  const top = Math.max(0, Math.floor((clipped.y - display.bounds.y) * scaleY));
  const right = Math.min(
    videoSize.width,
    Math.ceil((clipped.x + clipped.width - display.bounds.x) * scaleX),
  );
  const bottom = Math.min(
    videoSize.height,
    Math.ceil((clipped.y + clipped.height - display.bounds.y) * scaleY),
  );

  return { x: left, y: top, width: right - left, height: bottom - top };
}
