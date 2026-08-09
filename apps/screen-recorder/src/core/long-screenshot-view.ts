import type { Rectangle } from './geometry';

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
