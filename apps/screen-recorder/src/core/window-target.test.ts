import { describe, expect, it } from 'vitest';
import { findWindowTargetAt, mapWindowTargetsToDisplay } from './window-target';

describe('desktop window selection targets', () => {
  it('maps physical Windows rectangles into a negative-coordinate display and clips overflow', () => {
    const targets = mapWindowTargetsToDisplay(
      [{ id: 'wechat', title: '微信', processId: 22, x: -2100, y: -20, width: 900, height: 700 }],
      { x: -1920, y: 0, width: 1920, height: 1080 },
      (_rect) => ({ x: -1680, y: 0, width: 720, height: 560 }),
      99,
    );
    expect(targets).toEqual([
      {
        id: 'wechat',
        title: '微信',
        rect: { x: 240, y: 0, width: 720, height: 560 },
      },
    ]);
  });

  it('ignores the recorder process and chooses the topmost target under the pointer', () => {
    const targets = mapWindowTargetsToDisplay(
      [
        { id: 'overlay', title: 'Valley', processId: 99, x: 0, y: 0, width: 500, height: 500 },
        { id: 'top', title: '微信', processId: 22, x: 100, y: 100, width: 400, height: 300 },
        { id: 'back', title: 'Browser', processId: 33, x: 0, y: 0, width: 700, height: 500 },
      ],
      { x: 0, y: 0, width: 800, height: 600 },
      (rect) => rect,
      99,
    );
    expect(findWindowTargetAt(targets, { x: 200, y: 200 })?.id).toBe('top');
  });
});
