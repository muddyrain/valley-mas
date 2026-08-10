import { describe, expect, it } from 'vitest';
import { beginSelectionGesture, updateSelectionGesture } from './selection-controller';

const bounds = { x: 0, y: 0, width: 800, height: 600 };

describe('shared selection controller', () => {
  it('uses the same normalized drawing behavior for screenshot and recording selections', () => {
    const gesture = beginSelectionGesture({ point: { x: 300, y: 250 } });
    expect(updateSelectionGesture(gesture, { x: 100, y: 50 }, bounds)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 200,
    });
  });

  it('snaps a click to the detected window but switches to manual selection after dragging', () => {
    const target = { x: 80, y: 60, width: 420, height: 320 };
    const gesture = beginSelectionGesture({
      point: { x: 120, y: 100 },
      suggestedSelection: target,
    });
    expect(updateSelectionGesture(gesture, { x: 122, y: 102 }, bounds)).toEqual(target);
    expect(updateSelectionGesture(gesture, { x: 180, y: 150 }, bounds)).toEqual({
      x: 120,
      y: 100,
      width: 60,
      height: 50,
    });
  });

  it('moves an existing selection without leaving the display', () => {
    const gesture = beginSelectionGesture({
      point: { x: 200, y: 200 },
      selection: { x: 100, y: 100, width: 300, height: 200 },
      handle: 'move',
    });
    expect(updateSelectionGesture(gesture, { x: -100, y: -100 }, bounds)).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
    });
  });
});
