import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertPantryCutoutImageUsable,
  createPantryCutoutCoverFile,
  getPantryCutoutSupportReason,
  PANTRY_CUTOUT_MODEL,
  PANTRY_CUTOUT_TOOL,
  type PantryCutoutRunner,
} from '../src/lib/pantryCutout';

afterEach(() => {
  vi.useRealTimers();
});

describe('pantry local cutout', () => {
  it('uses IMG.LY with the smaller local model for fallback background removal', () => {
    expect(PANTRY_CUTOUT_TOOL).toBe('@imgly/background-removal');
    expect(PANTRY_CUTOUT_MODEL).toBe('isnet_quint8');
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
        data: new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      } as ImageData),
    ).toThrow('没有识别到可用主体');

    expect(() =>
      assertPantryCutoutImageUsable({
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]),
      } as ImageData),
    ).toThrow('模型没有分离背景');
  });

  it('accepts cutout output with transparent background and visible subject', () => {
    expect(() =>
      assertPantryCutoutImageUsable({
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([0, 0, 0, 0, 220, 40, 30, 255, 0, 0, 0, 0, 240, 230, 210, 255]),
      } as ImageData),
    ).not.toThrow();
  });
});
