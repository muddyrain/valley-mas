export const BOTTOM_SHEET_CLOSE_THRESHOLD = 84;
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

export function getBottomSheetDragOffset({
  startY,
  currentY,
  currentScrollTop,
  dragging,
  dragStartY,
}: BottomSheetDragOffsetInput) {
  if (currentScrollTop > 0) {
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
