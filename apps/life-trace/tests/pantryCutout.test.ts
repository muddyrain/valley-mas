import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertPantryCutoutImageUsable,
  createPantryCutoutCoverFile,
  getPantryCutoutSupportReason,
  type PantryCutoutRunner,
} from '../src/lib/pantryCutout';

const cutoutSource = await import('node:fs').then(({ readFileSync }) =>
  readFileSync(new URL('../src/lib/pantryCutout.ts', import.meta.url), 'utf8'),
);

afterEach(() => {
  vi.useRealTimers();
});

describe('pantry local cutout', () => {
  it('uses a model supported by the Transformers.js background-removal pipeline', () => {
    expect(cutoutSource).toContain("'Xenova/modnet'");
    expect(cutoutSource).not.toContain('briaai/RMBG-1.4');
  });

  it('wraps the local cutout PNG blob into a timestamped file', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T10:00:00Z'));
    const runner: PantryCutoutRunner = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));

    const file = await createPantryCutoutCoverFile(new Blob(['jpg'], { type: 'image/jpeg' }), {
      runner,
    });

    expect(file.name).toBe('pantry-transparent-cover-1780826400000.png');
    expect(file.type).toBe('image/png');
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('rejects non-png cutout output', async () => {
    const runner: PantryCutoutRunner = async () => new Blob(['jpg'], { type: 'image/jpeg' });

    await expect(
      createPantryCutoutCoverFile(new Blob(['jpg'], { type: 'image/jpeg' }), { runner }),
    ).rejects.toThrow('透明封面生成失败');
  });

  it('reports unsupported browser primitives', () => {
    expect(getPantryCutoutSupportReason({ blob: false, file: true })).toBe(
      '当前浏览器不支持本地抠图。',
    );
    expect(getPantryCutoutSupportReason({ blob: true, file: false })).toBe(
      '当前浏览器不支持保存透明封面。',
    );
  });

  it('rejects empty or black cutout model output before upload', () => {
    expect(() =>
      assertPantryCutoutImageUsable({
        width: 2,
        height: 2,
        channels: 4,
        data: new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      }),
    ).toThrow('没有识别到可用主体');

    expect(() =>
      assertPantryCutoutImageUsable({
        width: 2,
        height: 2,
        channels: 4,
        data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]),
      }),
    ).toThrow('模型没有分离背景');
  });

  it('accepts cutout output with transparent background and visible subject', () => {
    expect(() =>
      assertPantryCutoutImageUsable({
        width: 2,
        height: 2,
        channels: 4,
        data: new Uint8ClampedArray([0, 0, 0, 0, 220, 40, 30, 255, 0, 0, 0, 0, 240, 230, 210, 255]),
      }),
    ).not.toThrow();
  });
});
