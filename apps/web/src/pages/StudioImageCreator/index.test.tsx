/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listAvailableAIModels: vi.fn(),
  listAIImageCreationOptions: vi.fn(),
  listAIImageGenerations: vi.fn(),
  createAIImageGeneration: vi.fn(),
  getAIImageGeneration: vi.fn(),
  saveAIImageGenerationResource: vi.fn(),
}));

vi.mock('@/api/ai', () => ({ listAvailableAIModels: api.listAvailableAIModels }));
vi.mock('@/api/aiImages', () => ({
  listAIImageCreationOptions: api.listAIImageCreationOptions,
  listAIImageGenerations: api.listAIImageGenerations,
  createAIImageGeneration: api.createAIImageGeneration,
  getAIImageGeneration: api.getAIImageGeneration,
  saveAIImageGenerationResource: api.saveAIImageGenerationResource,
}));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载创作选项</div> : null),
}));

import StudioImageCreator from '.';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listAvailableAIModels.mockResolvedValue({
    list: [{ id: 'model-1', displayName: '图片模型', provider: 'provider', capabilities: [] }],
  });
  api.listAIImageCreationOptions.mockResolvedValue({
    recipes: [
      { id: 'free', name: '自由创作', recommendedAspect: '1:1' },
      { id: 'cover', name: '文章封面', recommendedAspect: '16:9' },
    ],
    styleProfiles: [],
    aspectRatios: ['1:1', '16:9'],
    qualities: ['1K'],
    sizes: {},
  });
  api.listAIImageGenerations.mockResolvedValue({ list: [] });
  api.createAIImageGeneration.mockResolvedValue({
    generation: { id: 'gen-1', status: 'succeeded', resultUrl: '/result.webp' },
  });
});

describe('StudioImageCreator', () => {
  it('maps article-cover intent to the cover generation recipe', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <StudioImageCreator />
        </MemoryRouter>,
      ),
    );
    await flush();

    const purposeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '文章封面',
    );
    act(() => purposeButton?.click());
    const textarea = container.querySelector('textarea');
    act(() => {
      if (!textarea) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, '雾中的山谷与留白构图');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const generateButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '生成图片',
    );
    await act(async () => generateButton?.click());

    expect(api.createAIImageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'model-1',
        recipeId: 'cover',
        aspectRatio: '16:9',
        brief: '雾中的山谷与留白构图',
      }),
    );

    act(() => root.unmount());
    container.remove();
  });
});
