import { clampRectToBounds, type Rectangle } from './geometry';

export function createSelectionMaskRects(bounds: Rectangle, selection?: Rectangle): Rectangle[] {
  if (!selection) return [bounds];

  const clipped = clampRectToBounds(selection, bounds);
  if (clipped.width <= 0 || clipped.height <= 0) return [bounds];

  const right = clipped.x + clipped.width;
  const bottom = clipped.y + clipped.height;
  return [
    { x: bounds.x, y: bounds.y, width: bounds.width, height: clipped.y - bounds.y },
    { x: bounds.x, y: clipped.y, width: clipped.x - bounds.x, height: clipped.height },
    {
      x: right,
      y: clipped.y,
      width: bounds.x + bounds.width - right,
      height: clipped.height,
    },
    {
      x: bounds.x,
      y: bottom,
      width: bounds.width,
      height: bounds.y + bounds.height - bottom,
    },
  ].filter((rect) => rect.width > 0 && rect.height > 0);
}
