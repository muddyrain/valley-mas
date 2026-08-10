import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  findWindowTargetAt,
  findWindowTargetAtOrDisplay,
  mapWindowTargetsToDisplay,
} from './window-target';

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

  it('keeps compact macOS menu bar items as selectable targets', () => {
    const targets = mapWindowTargetsToDisplay(
      [
        {
          id: 'wechat-status-item',
          title: '微信',
          processId: 22,
          kind: 'system-ui',
          x: 2400,
          y: 0,
          width: 12,
          height: 25,
        },
      ],
      { x: 0, y: 0, width: 2560, height: 1440 },
      (rect) => rect,
      99,
    );

    expect(targets).toEqual([
      {
        id: 'wechat-status-item',
        title: '微信',
        rect: { x: 2400, y: 0, width: 12, height: 25 },
      },
    ]);
  });

  it('falls back to the full current display when the pointer is over desktop space', () => {
    const displayBounds = { x: 0, y: 0, width: 2560, height: 1440 };

    expect(findWindowTargetAtOrDisplay([], { x: 1200, y: 1200 }, displayBounds)).toEqual({
      id: '__display__',
      title: '全屏',
      rect: displayBounds,
    });
  });

  it('enumerates macOS main-menu and status-item window levels', async () => {
    const helperSource = await readFile(
      new URL('../../native/macos-window-query.m', import.meta.url),
      'utf8',
    );

    expect(helperSource).toContain('kCGMainMenuWindowLevelKey');
    expect(helperSource).toContain('kCGStatusWindowLevelKey');
  });
});
