/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPosts, getAllResources } = vi.hoisted(() => ({
  getPosts: vi.fn(),
  getAllResources: vi.fn(),
}));

vi.mock('@/api/blog', () => ({ getPosts }));
vi.mock('@/api/resource', () => ({ getAllResources }));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载中</div> : null),
}));

import YujiHome from '.';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getPosts.mockResolvedValue({
    list: [
      {
        id: 'post-1',
        title: '组件渲染性能优化',
        excerpt: '让更新边界更清楚。',
        group: { name: 'React' },
        cover: '/cover.webp',
        createdAt: '2026-08-06T00:00:00Z',
      },
    ],
    total: 1,
  });
  getAllResources.mockResolvedValue({
    list: [
      {
        id: 'image-1',
        title: '春日摄影之旅',
        url: '/image.webp',
        type: 'wallpaper',
      },
    ],
    total: 1,
  });
});

describe('YujiHome', () => {
  it('uses public content APIs and links featured content into the new route family', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <YujiHome />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(getPosts).toHaveBeenCalledWith({ page: 1, pageSize: 4 });
    expect(getAllResources).toHaveBeenCalledWith({ page: 1, pageSize: 6, includeTags: true });
    expect(container.textContent).toContain('组件渲染性能优化');
    expect(container.textContent).toContain('春日摄影之旅');
    expect(container.querySelector('a[href="/articles/post-1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/gallery/image/image-1"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
