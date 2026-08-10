import type { Rectangle } from './geometry';

const TOOLBAR_WIDTH = 611;
const TOOLBAR_HEIGHT = 48;
const TOOLBAR_GAP = 12;
const VIEWPORT_INSET = 12;

export function getScreenshotToolbarPosition(
  selection: Rectangle,
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const maxLeft = Math.max(VIEWPORT_INSET, viewport.width - TOOLBAR_WIDTH - VIEWPORT_INSET);
  const left = Math.max(
    VIEWPORT_INSET,
    Math.min(maxLeft, selection.x + selection.width - TOOLBAR_WIDTH),
  );
  const below = selection.y + selection.height + TOOLBAR_GAP;
  const top =
    below + TOOLBAR_HEIGHT <= viewport.height - VIEWPORT_INSET
      ? below
      : Math.max(VIEWPORT_INSET, selection.y - TOOLBAR_HEIGHT - TOOLBAR_GAP);

  return { left, top };
}
