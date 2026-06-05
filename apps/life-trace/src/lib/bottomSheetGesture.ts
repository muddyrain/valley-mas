export const BOTTOM_SHEET_CLOSE_THRESHOLD = 84;
export const BOTTOM_SHEET_INTERACTIVE_SELECTOR =
  'button, input, textarea, select, option, a, label, [role="button"], [contenteditable="true"], [data-sheet-drag-ignore="true"]';
const DRAG_START_THRESHOLD = 8;

type ShouldStartBottomSheetDragInput = {
  open: boolean;
  closeDisabled: boolean;
  targetIsInteractive: boolean;
};

type BottomSheetDragOffsetInput = {
  startY: number;
  currentY: number;
  currentScrollTop: number;
  dragging: boolean;
  dragStartY?: number;
};

type ShouldCloseBottomSheetByDragInput = {
  finalOffset: number;
  closeDisabled: boolean;
  closeThreshold?: number;
};

export function shouldStartBottomSheetDrag({
  open,
  closeDisabled,
  targetIsInteractive,
}: ShouldStartBottomSheetDragInput) {
  return open && !closeDisabled && !targetIsInteractive;
}

export function isBottomSheetInteractiveTarget(target: EventTarget | null) {
  const closest = (target as { closest?: unknown } | null)?.closest;
  if (typeof closest !== 'function') {
    return false;
  }

  return Boolean(closest.call(target, BOTTOM_SHEET_INTERACTIVE_SELECTOR));
}

export function getBottomSheetDragOffset({
  startY,
  currentY,
  currentScrollTop,
  dragging,
  dragStartY,
}: BottomSheetDragOffsetInput) {
  if (!dragging && currentScrollTop > 0) {
    return null;
  }

  const nextOffset = Math.max(0, currentY - (dragging ? (dragStartY ?? startY) : startY));
  if (!dragging && nextOffset < DRAG_START_THRESHOLD) {
    return null;
  }

  return nextOffset;
}

export function shouldCloseBottomSheetByDrag({
  finalOffset,
  closeDisabled,
  closeThreshold = BOTTOM_SHEET_CLOSE_THRESHOLD,
}: ShouldCloseBottomSheetByDragInput) {
  return !closeDisabled && finalOffset >= closeThreshold;
}
