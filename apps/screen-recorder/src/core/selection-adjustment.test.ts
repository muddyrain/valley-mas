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

  it('resizes from each edge while preserving the opposite edge', () => {
    expect(adjustSelection(selection, 'n', { x: 800, y: 120 }, bounds)).toEqual({
      x: 400,
      y: 120,
      width: 640,
      height: 440,
    });
    expect(adjustSelection(selection, 'e', { x: 1280, y: 400 }, bounds)).toEqual({
      x: 400,
      y: 200,
      width: 880,
      height: 360,
    });
    expect(adjustSelection(selection, 's', { x: 800, y: 720 }, bounds)).toEqual({
      x: 400,
      y: 200,
      width: 640,
      height: 520,
    });
    expect(adjustSelection(selection, 'w', { x: 280, y: 400 }, bounds)).toEqual({
      x: 280,
      y: 200,
      width: 760,
      height: 360,
    });
  });

  it('uses pointer movement for resize handles without jumping to the handle center', () => {
    expect(
      adjustSelection(selection, 'se', { x: 1078, y: 586 }, bounds, { x: 1042, y: 562 }),
    ).toEqual({ x: 400, y: 200, width: 676, height: 384 });
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
