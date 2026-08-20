/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getPostDetailById } = vi.hoisted(() => ({ getPostDetailById: vi.fn() }));

vi.mock('@/api/blog', () => ({ getPostDetailById }));

import YujiArticle from '.';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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

afterEach(() => {
  vi.useRealTimers();
});

describe('YujiArticle', () => {
  it('uses an article-shaped loading surface only after the delay', async () => {
    vi.useFakeTimers();
    const request = deferred<Awaited<ReturnType<typeof getPostDetailById>>>();
    getPostDetailById.mockReturnValueOnce(request.promise);
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

    expect(container.querySelector('[role="status"]')).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(container.querySelector('[data-variant="article"]')).not.toBeNull();

    await act(async () => {
      request.resolve({
        id: 'post-1',
        title: '组件渲染性能优化',
        content: '正文',
        createdAt: '2026-08-06T00:00:00Z',
      });
      await request.promise;
    });
    expect(container.querySelector('[data-variant="article"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

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
    expect(container.querySelector('.yuji-article-note')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('omits the sticky table of contents for a short article', async () => {
    getPostDetailById.mockResolvedValueOnce({
      id: 'post-short',
      title: '一则短记',
      content: '只有一段安静的正文。',
      createdAt: '2026-08-20T00:00:00Z',
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/articles/post-short']}>
          <Routes>
            <Route path="/articles/:id" element={<YujiArticle />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(container.querySelector('.yuji-article-toc')).toBeNull();
    expect(container.querySelector('.yuji-article-body')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('keeps a failed article in place with an explicit retry', async () => {
    getPostDetailById.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({
      id: 'post-1',
      title: '重新抵达的文章',
      content: '正文',
      createdAt: '2026-08-06T00:00:00Z',
    });
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

    expect(container.textContent).toContain('这篇文章暂时没有抵达。');
    await act(async () => {
      container.querySelector('button')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getPostDetailById).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('重新抵达的文章');

    act(() => root.unmount());
    container.remove();
  });
});
