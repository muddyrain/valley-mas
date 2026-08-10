import { type DisplayGeometry, findDisplayForPoint, type Point } from './geometry';

export function findSelectionDisplayChange(
  displays: readonly DisplayGeometry[],
  currentDisplayId: string,
  cursor: Point,
  gestureActive: boolean,
): DisplayGeometry | undefined {
  if (gestureActive) return undefined;
  const display = findDisplayForPoint(displays, cursor);
  return display?.id === currentDisplayId ? undefined : display;
}
