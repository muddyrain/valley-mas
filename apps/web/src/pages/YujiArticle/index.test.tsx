/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPostDetailById } = vi.hoisted(() => ({ getPostDetailById: vi.fn() }));

vi.mock('@/api/blog', () => ({ getPostDetailById }));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载中</div> : null),
}));

import YujiArticle from '.';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getPostDetailById.mockResolvedValue({
    id: 'post-1',
    title: '组件渲染性能优化',
    excerpt: '让更新边界更清楚。',
    content: '# 组件渲染性能优化\n\n## 为什么会重新渲染\n\n正文内容。',
    group: { name: 'React' },
    tags: [{ id: 'tag-1', name: '性能优化', slug: 'performance' }],
    createdAt: '2026-08-06T00:00:00Z',
  });
});

describe('YujiArticle', () => {
  it('renders public article content, table of contents and author identity', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/articles/post-1']}>
          <Routes>
            <Route path="/articles/:id" element={<YujiArticle />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(getPostDetailById).toHaveBeenCalledWith('post-1', { suppressErrorToast: true });
    expect(container.textContent).toContain('组件渲染性能优化');
    expect(container.textContent).toContain('为什么会重新渲染');
    expect(container.textContent).toContain('by @muddyrain');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('.yuji-article-body h1')).toBeNull();
    expect(container.querySelector('article h2')?.id).toBe('为什么会重新渲染');

    act(() => root.unmount());
    container.remove();
  });
});
