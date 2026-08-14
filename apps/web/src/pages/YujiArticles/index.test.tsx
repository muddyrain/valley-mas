/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getGroups, getPosts } = vi.hoisted(() => ({ getGroups: vi.fn(), getPosts: vi.fn() }));

vi.mock('@/api/blog', () => ({ getGroups, getPosts }));

import YujiArticles from '.';

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
  getGroups.mockResolvedValue([{ id: 'react', name: 'React' }]);
  getPosts.mockResolvedValue({
    list: [
      {
        id: 'post-1',
        title: '错误边界',
        excerpt: '局部异常不应该让整个界面消失。',
        group: { name: 'React' },
        createdAt: '2026-08-06T00:00:00Z',
      },
    ],
    total: 1,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('YujiArticles', () => {
  it('delays the consumer loading surface and reveals article-shaped content after 300ms', async () => {
    vi.useFakeTimers();
    const request = deferred<Awaited<ReturnType<typeof getPosts>>>();
    getPosts.mockReturnValueOnce(request.promise);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <MemoryRouter>
          <YujiArticles />
        </MemoryRouter>,
      ),
    );

    expect(container.querySelector('[role="status"]')).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(container.querySelector('[data-variant="writing"]')).not.toBeNull();

    await act(async () => {
      request.resolve({ list: [], total: 0, page: 1, pageSize: 12 });
      await request.promise;
    });
    expect(container.querySelector('[data-variant="writing"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('restores the selected column from the URL and requests matching posts', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/articles?groupId=react']}>
          <YujiArticles />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(getPosts).toHaveBeenCalledWith({ page: 1, pageSize: 12, groupId: 'react' });
    expect(container.textContent).toContain('错误边界');
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toBe('React');
    expect(container.querySelector('a[href="/articles/post-1"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('uses a dedicated single-track column rail instead of a wrapping filter list', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <YujiArticles />
        </MemoryRouter>,
      ),
    );
    await flush();

    const rail = container.querySelector('.yuji-column-rail');
    expect(rail).not.toBeNull();
    expect(rail?.querySelector('.yuji-column-rail-heading')?.textContent).toContain('专栏');
    expect(rail?.querySelector('.yuji-column-track')).not.toBeNull();
    expect(container.textContent).not.toContain('按专栏阅读');

    act(() => root.unmount());
    container.remove();
  });

  it('offers an inline retry after the article request fails', async () => {
    getPosts
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ list: [], total: 0 });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <YujiArticles />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(container.textContent).toContain('文章暂时没有抵达。');
    const retry = container.querySelector('button');
    await act(async () => {
      retry?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getPosts).toHaveBeenCalledTimes(2);

    act(() => root.unmount());
    container.remove();
  });
});
