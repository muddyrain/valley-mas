import { describe, expect, it } from 'vitest';
import {
  getBottomSheetDragOffset,
  shouldCloseBottomSheetByDrag,
  shouldStartBottomSheetDrag,
} from '../src/lib/bottomSheetGesture';

describe('bottom sheet gesture helpers', () => {
  it('does not start a sheet drag from interactive controls so close buttons keep clicking', () => {
    expect(
      shouldStartBottomSheetDrag({
        open: true,
        closeDisabled: false,
        targetIsInteractive: true,
      }),
    ).toBe(false);
  });

  it('starts dragging once a downward gesture reaches the top of a scrolled sheet', () => {
    expect(
      getBottomSheetDragOffset({
        startY: 100,
        currentY: 190,
        currentScrollTop: 0,
        dragging: false,
      }),
    ).toBe(90);
  });

  it('keeps normal scrolling while the sheet content is still away from the top', () => {
    expect(
      getBottomSheetDragOffset({
        startY: 100,
        currentY: 190,
        currentScrollTop: 12,
        dragging: false,
      }),
    ).toBeNull();
  });

  it('closes only after the drag crosses the threshold and closing is allowed', () => {
    expect(shouldCloseBottomSheetByDrag({ finalOffset: 83, closeDisabled: false })).toBe(false);
    expect(shouldCloseBottomSheetByDrag({ finalOffset: 84, closeDisabled: false })).toBe(true);
    expect(shouldCloseBottomSheetByDrag({ finalOffset: 120, closeDisabled: true })).toBe(false);
  });
});
