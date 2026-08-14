/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAdminPosts } = vi.hoisted(() => ({ getAdminPosts: vi.fn() }));
vi.mock('@/api/blog', () => ({ getAdminPosts }));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载草稿</div> : null),
}));

import StudioHome from '.';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getAdminPosts.mockResolvedValue({
    list: [
      {
        id: 'draft-1',
        title: 'React 错误边界实践',
        postType: 'blog',
        status: 'draft',
        group: { name: 'React' },
        createdAt: '2026-08-14T00:00:00Z',
      },
    ],
    total: 1,
  });
});

describe('StudioHome', () => {
  it('keeps the three primary tasks prominent and lists real drafts', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <StudioHome />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(container.textContent).toContain('今天从哪里开始？');
    expect(container.querySelector('a[href="/studio/articles/new"]')?.textContent).toContain(
      '写文章',
    );
    expect(container.querySelector('a[href="/studio/images/import"]')?.textContent).toContain(
      '导入图片',
    );
    expect(container.querySelector('a[href="/studio/images"]')?.textContent).toContain('AI 图片');
    expect(container.textContent).toContain('React 错误边界实践');
    expect(container.querySelector('a[href="/studio/articles/draft-1"]')).not.toBeNull();
    expect(getAdminPosts).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', postType: 'blog' }),
    );

    act(() => root.unmount());
    container.remove();
  });
});
