import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  createPinnedScreenshotMenuIconBitmap,
  createPinnedScreenshotMenuItems,
  getPinnedScreenshotBounds,
  getPinnedScreenshotMenuDisplayLabel,
  getPinnedScreenshotWindowBounds,
  tryCreatePinnedScreenshotMenuIcon,
} from './pinned-screenshot';

describe('pinned screenshot window bounds', () => {
  it('keeps a large pinned screenshot at the exact original selection bounds', () => {
    const selection = { x: -1920, y: 0, width: 1920, height: 1040 };

    expect(
      getPinnedScreenshotBounds(selection, { x: -1920, y: 0, width: 1920, height: 1040 }),
    ).toEqual(selection);
  });

  it('keeps a small pinned screenshot at its original selection position', () => {
    const selection = { x: 160, y: 120, width: 320, height: 180 };

    expect(getPinnedScreenshotBounds(selection, { x: 0, y: 0, width: 1920, height: 1040 })).toEqual(
      selection,
    );
  });

  it('reserves transparent space around the image so its border shadow is not clipped', () => {
    const selection = { x: 160, y: 120, width: 320, height: 180 };

    expect(
      getPinnedScreenshotWindowBounds(selection, { x: 0, y: 0, width: 1920, height: 1040 }, 12),
    ).toEqual({
      image: selection,
      window: { x: 148, y: 108, width: 344, height: 204 },
    });
  });

  it('builds a native context menu with copy, download, and close actions', () => {
    const calls: string[] = [];
    const items = createPinnedScreenshotMenuItems({
      copy: () => calls.push('copy'),
      download: () => calls.push('download'),
      close: () => calls.push('close'),
    });

    expect(items.map((item) => (item.type === 'separator' ? 'separator' : item.label))).toEqual([
      '复制',
      '下载',
      'separator',
      '关闭',
    ]);
    expect(items.flatMap((item) => (item.type === 'separator' ? [] : [item.action]))).toEqual([
      'copy',
      'download',
      'close',
    ]);
    for (const item of items) {
      if (item.type !== 'separator') item.click();
    }
    expect(calls).toEqual(['copy', 'download', 'close']);
  });

  it('adds stable visual width without changing the visible action copy', () => {
    const label = getPinnedScreenshotMenuDisplayLabel('复制');

    expect(label.startsWith('复制')).toBe(true);
    expect(label.replaceAll('　', '')).toBe('复制');
    expect(Array.from(label)).toHaveLength(6);
  });

  it.each([
    'copy',
    'download',
    'close',
  ] as const)('creates a non-empty bitmap for the %s menu icon', (action) => {
    const bitmap = createPinnedScreenshotMenuIconBitmap(action);

    expect(bitmap).toMatchObject({ width: 32, height: 32, scaleFactor: 2 });
    expect(bitmap.data).toHaveLength(32 * 32 * 4);
    const alphaValues = bitmap.data.filter((_, index) => index % 4 === 3);
    expect(alphaValues.some((alpha) => alpha === 255)).toBe(true);
    expect(alphaValues.some((alpha) => alpha === 0)).toBe(true);
  });

  it('falls back to a menu without an icon when native image creation fails', () => {
    expect(
      tryCreatePinnedScreenshotMenuIcon('copy', () => {
        throw new Error('unsupported image');
      }),
    ).toBeUndefined();
  });

  it('wires pinned screenshot actions and capture visibility through the main process', async () => {
    const mainSource = await readFile(new URL('../../electron/main.ts', import.meta.url), 'utf8');

    expect(mainSource).toContain('Menu.buildFromTemplate');
    expect(mainSource).toContain('createPinnedScreenshotMenuItems');
    expect(mainSource).toContain('label: getPinnedScreenshotMenuDisplayLabel(item.label)');
    expect(mainSource).toContain('nativeImage.createFromBitmap');
    expect(mainSource).toContain('...(icon ? { icon } : {})');
    expect(mainSource).not.toContain('固定图片菜单图标无法读取');
    expect(mainSource).toContain('pinnedWindow.setBounds(bounds.window)');
    expect(mainSource).toContain("shouldProtectWindowContent('pinned-screenshot')");
    expect(mainSource).toContain("getAlwaysOnTopRelativeLevel('capture-overlay')");
  });
});
