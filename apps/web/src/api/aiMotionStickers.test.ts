import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/utils/request', () => ({
  default: { get: getMock, post: postMock, delete: vi.fn() },
}));

import {
  createAIMotionSticker,
  listAIMotionStickerOptions,
  listAIMotionStickers,
} from './aiMotionStickers';

describe('api/aiMotionStickers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads the reference image and action as multipart data', async () => {
    postMock.mockResolvedValue({ id: '1' });
    const file = new File(['image'], 'character.png', { type: 'image/png' });

    await createAIMotionSticker({ mode: 'image', modelId: '9', action: '跳一下', reference: file });

    const [path, body, config] = postMock.mock.calls[0];
    expect(path).toBe('/ai/motion-stickers');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('modelId')).toBe('9');
    expect(body.get('mode')).toBe('image');
    expect(body.get('action')).toBe('跳一下');
    expect(body.get('reference')).toBe(file);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('loads only the current user history endpoint', async () => {
    getMock.mockResolvedValue({ items: [] });
    await listAIMotionStickers();
    expect(getMock).toHaveBeenCalledWith('/ai/motion-stickers');
  });

  it('falls back to the legacy video-only options response during a rolling deploy', async () => {
    const legacyModel = {
      id: '9',
      name: 'Seedance',
      provider: 'amux',
      model: 'doubao-seedance-2.0-fast',
    };
    getMock.mockResolvedValue({
      models: [legacyModel],
      defaults: { durationSeconds: 5, resolution: '720p', aspectRatio: '1:1', gifSize: 320 },
    });

    const result = await listAIMotionStickerOptions();

    expect(result.defaultMode).toBe('video');
    expect(result.imageModels).toEqual([]);
    expect(result.videoModels).toEqual([legacyModel]);
    expect(result.defaults.frameCount).toBe(6);
  });
});
