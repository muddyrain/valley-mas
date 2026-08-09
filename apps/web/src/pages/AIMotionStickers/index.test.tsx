/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/aiMotionStickers', () => ({
  listAIMotionStickerOptions: vi.fn(),
  listAIMotionStickers: vi.fn(),
  createAIMotionSticker: vi.fn(),
  getAIMotionSticker: vi.fn(),
  deleteAIMotionSticker: vi.fn(),
  fetchAIMotionStickerContent: vi.fn(),
}));

import AIMotionStickers, { getAIMotionStickerModeLabel } from '.';

describe('AIMotionStickers', () => {
  it('renders the private reference-to-loop creation workspace', () => {
    const markup = renderToStaticMarkup(<AIMotionStickers />);

    expect(markup).toContain('AI 动态表情');
    expect(markup).toContain('上传参考图');
    expect(markup).toContain('描述角色动作');
    expect(markup).toContain('生图 GIF');
    expect(markup).toContain('视频增强');
    expect(markup).toContain('默认无缝循环');
    expect(markup).toContain('仅自己可见');
  });

  it('treats legacy records without a generation mode as video jobs', () => {
    expect(getAIMotionStickerModeLabel()).toBe('视频增强');
    expect(getAIMotionStickerModeLabel('image')).toBe('生图 GIF');
  });
});
