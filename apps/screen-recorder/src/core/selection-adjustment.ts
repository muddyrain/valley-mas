import { clampRectToBounds, normalizeSelection, type Point, type Rectangle } from './geometry';

export type SelectionHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'move';

function clampPoint(point: Point, bounds: Rectangle): Point {
  return {
    x: Math.max(bounds.x, Math.min(point.x, bounds.x + bounds.width)),
    y: Math.max(bounds.y, Math.min(point.y, bounds.y + bounds.height)),
  };
}

export function adjustSelection(
  selection: Rectangle,
  handle: SelectionHandle,
  point: Point,
  bounds: Rectangle,
  pointerStart?: Point,
): Rectangle {
  if (handle === 'move') {
    if (!pointerStart) {
      throw new Error('移动选区缺少起始坐标');
    }
    const nextX = selection.x + point.x - pointerStart.x;
    const nextY = selection.y + point.y - pointerStart.y;
    return {
      ...selection,
      x: Math.max(bounds.x, Math.min(nextX, bounds.x + bounds.width - selection.width)),
      y: Math.max(bounds.y, Math.min(nextY, bounds.y + bounds.height - selection.height)),
    };
  }

  const left = selection.x;
  const top = selection.y;
  const right = selection.x + selection.width;
  const bottom = selection.y + selection.height;
  const next = clampPoint(
    pointerStart
      ? {
          x: handle.includes('w')
            ? left + point.x - pointerStart.x
            : handle.includes('e')
              ? right + point.x - pointerStart.x
              : point.x,
          y: handle.includes('n')
            ? top + point.y - pointerStart.y
            : handle.includes('s')
              ? bottom + point.y - pointerStart.y
              : point.y,
        }
      : point,
    bounds,
  );
  const start = {
    x: handle.includes('w') ? next.x : left,
    y: handle.includes('n') ? next.y : top,
  };
  const end = {
    x: handle.includes('e') ? next.x : right,
    y: handle.includes('s') ? next.y : bottom,
  };
  return clampRectToBounds(normalizeSelection(start, end), bounds);
}
