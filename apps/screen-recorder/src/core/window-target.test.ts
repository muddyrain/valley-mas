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

  it('skips Windows utility and cloaked overlays before finding the client window', async () => {
    const targets = mapWindowTargetsToDisplay(
      [
        {
          id: 'nvidia-overlay',
          title: 'NVIDIA GeForce Overlay',
          processId: 22,
          isToolWindow: true,
          x: 0,
          y: 0,
          width: 3440,
          height: 1440,
        },
        {
          id: 'input-experience',
          title: 'Windows Input Experience',
          processId: 33,
          isCloaked: true,
          x: 0,
          y: 0,
          width: 3440,
          height: 1440,
        },
        {
          id: 'chatgpt',
          title: 'ChatGPT',
          processId: 44,
          x: 746,
          y: 167,
          width: 1498,
          height: 1102,
        },
      ],
      { x: 0, y: 0, width: 3440, height: 1440 },
      (rect) => rect,
      99,
    );

    expect(findWindowTargetAt(targets, { x: 1200, y: 600 })?.id).toBe('chatgpt');

    const mainSource = await readFile(new URL('../../electron/main.ts', import.meta.url), 'utf8');
    expect(mainSource).toContain('GetWindowLongW');
    expect(mainSource).toContain('isToolWindow');
    expect(mainSource).toContain('isCloaked');
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
