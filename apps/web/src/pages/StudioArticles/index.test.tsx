/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAdminPosts } = vi.hoisted(() => ({ getAdminPosts: vi.fn() }));
vi.mock('@/api/blog', () => ({ getAdminPosts }));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载文章</div> : null),
}));

import StudioArticles from '.';

beforeEach(() => {
  vi.clearAllMocks();
  getAdminPosts.mockResolvedValue({
    list: [
      {
        id: '1',
        title: '旧博客',
        postType: 'blog',
        status: 'draft',
        createdAt: '2026-08-14T00:00:00Z',
      },
      {
        id: '2',
        title: '旧图文',
        postType: 'image_text',
        status: 'published',
        createdAt: '2026-08-13T00:00:00Z',
      },
    ],
    total: 2,
  });
});

describe('StudioArticles', () => {
  it('presents legacy blog and image-text records as one article library', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <StudioArticles />
        </MemoryRouter>,
      ),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('文章草稿');
    expect(container.textContent).toContain('旧博客');
    expect(container.textContent).toContain('旧图文');
    expect(container.textContent).not.toContain('图文类型');
    expect(container.querySelector('a[href="/studio/articles/1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/my-space/image-text-edit/2"]')).not.toBeNull();
    expect(getAdminPosts).toHaveBeenCalledWith(
      expect.not.objectContaining({ postType: expect.anything() }),
    );

    act(() => root.unmount());
    container.remove();
  });
});
