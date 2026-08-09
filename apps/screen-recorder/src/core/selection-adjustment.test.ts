import { describe, expect, it } from 'vitest';
import { adjustSelection } from './selection-adjustment';

const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
const selection = { x: 400, y: 200, width: 640, height: 360 };

describe('configured recording selection adjustment', () => {
  it('expands and shrinks from resize handles', () => {
    expect(adjustSelection(selection, 'se', { x: 1280, y: 720 }, bounds)).toEqual({
      x: 400,
      y: 200,
      width: 880,
      height: 520,
    });
    expect(adjustSelection(selection, 'nw', { x: 520, y: 280 }, bounds)).toEqual({
      x: 520,
      y: 280,
      width: 520,
      height: 280,
    });
  });

  it('normalizes a resize that crosses the opposite corner', () => {
    expect(adjustSelection(selection, 'nw', { x: 1200, y: 700 }, bounds)).toEqual({
      x: 1040,
      y: 560,
      width: 160,
      height: 140,
    });
  });

  it('moves the rectangle without allowing it outside its display', () => {
    expect(
      adjustSelection(selection, 'move', { x: -500, y: 1_000 }, bounds, {
        x: 500,
        y: 300,
      }),
    ).toEqual({ x: 0, y: 720, width: 640, height: 360 });
  });
});
