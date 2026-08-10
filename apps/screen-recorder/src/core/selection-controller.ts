import { clampRectToBounds, normalizeSelection, type Point, type Rectangle } from './geometry';
import { adjustSelection, type SelectionHandle } from './selection-adjustment';

export type SelectionGesture =
  | { kind: 'draw'; start: Point; suggestedSelection?: Rectangle }
  | {
      kind: 'adjust';
      handle: SelectionHandle;
      pointerStart: Point;
      selection: Rectangle;
    };

export function beginSelectionGesture(input: {
  point: Point;
  suggestedSelection?: Rectangle;
  selection?: Rectangle;
  handle?: SelectionHandle;
}): SelectionGesture {
  if (input.selection) {
    return {
      kind: 'adjust',
      handle: input.handle ?? 'move',
      pointerStart: input.point,
      selection: input.selection,
    };
  }
  return { kind: 'draw', start: input.point, suggestedSelection: input.suggestedSelection };
}

export function updateSelectionGesture(
  gesture: SelectionGesture,
  point: Point,
  bounds: Rectangle,
  snapDistance = 4,
): Rectangle {
  if (gesture.kind === 'adjust') {
    return adjustSelection(gesture.selection, gesture.handle, point, bounds, gesture.pointerStart);
  }
  const moved = Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y);
  if (gesture.suggestedSelection && moved <= snapDistance) {
    return clampRectToBounds(gesture.suggestedSelection, bounds);
  }
  return clampRectToBounds(normalizeSelection(gesture.start, point), bounds);
}
