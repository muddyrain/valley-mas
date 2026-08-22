/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getPosts, getAllResources } = vi.hoisted(() => ({
  getPosts: vi.fn(),
  getAllResources: vi.fn(),
}));

vi.mock('@/api/blog', () => ({ getPosts }));
vi.mock('@/api/resource', () => ({ getAllResources }));

import YujiHome from '.';

const postPayload = {
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
};

const resourcePayload = {
  list: [
    {
      id: 'image-1',
      title: '春日摄影之旅',
      url: '/image.webp',
      type: 'wallpaper',
    },
  ],
  total: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getPosts.mockResolvedValue(postPayload);
  getAllResources.mockResolvedValue(resourcePayload);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('YujiHome', () => {
  it('keeps the public stage available while posts and images reveal independently', async () => {
    vi.useFakeTimers();
    const postsRequest = deferred<typeof postPayload>();
    const resourcesRequest = deferred<typeof resourcePayload>();
    getPosts.mockReturnValueOnce(postsRequest.promise);
    getAllResources.mockReturnValueOnce(resourcesRequest.promise);

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

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[data-yuji-stage="wordmark"]')).not.toBeNull();
    const wordmarkTitle = container.querySelector('#yuji-wordmark-title') as HTMLElement;
    expect(wordmarkTitle).not.toBeNull();
    expect(wordmarkTitle.getAttribute('aria-label')).toBe('muddyrain');
    expect(wordmarkTitle.textContent).toBe('muddyrain');
    expect(container.textContent).toContain('YUJI.DESIGN / INDEPENDENT FIELD');
    expect(container.textContent).toContain('前端、工具与影像');
    expect(container.textContent).toContain('保持好奇');
    expect(container.textContent).toContain('允许偏航');
    expect(container.textContent).toContain('找到自己的节奏');
    expect(container.textContent).not.toContain('代码开发者，现居杭州');
    expect(container.textContent).not.toContain('来自上海');
    expect(container.textContent).toContain('把想法写下来');
    const githubAvatar = container.querySelector<HTMLImageElement>(
      'img[alt="muddyrain 的 GitHub 头像"]',
    );
    expect(githubAvatar?.src).toBe('https://github.com/muddyrain.png?size=640');
    expect(container.querySelector('a[href="https://github.com/muddyrain"]')).not.toBeNull();
    expect(container.querySelectorAll('.yuji-sticker-field svg')).toHaveLength(6);
    expect(container.querySelectorAll('[data-yuji-sticker]')).toHaveLength(6);

    act(() => vi.advanceTimersByTime(300));
    expect(
      Array.from(container.querySelectorAll('[role="status"]')).map((node) =>
        node.getAttribute('aria-label'),
      ),
    ).toEqual(expect.arrayContaining(['文章正在显影', '影像正在显影']));

    await act(async () => {
      postsRequest.resolve(postPayload);
      await postsRequest.promise;
    });

    expect(container.textContent).toContain('组件渲染性能优化');
    const articleTitle = container.querySelector<HTMLAnchorElement>('.yuji-stage-article-title');
    expect(articleTitle?.textContent).toBe('组件渲染性能优化');
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      '影像正在显影',
    );

    await act(async () => {
      resourcesRequest.resolve(resourcePayload);
      await resourcesRequest.promise;
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).toContain('春日摄影之旅');

    act(() => root.unmount());
    container.remove();
  });

  it('uses public content APIs only for the content that follows the brand stage', async () => {
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

    expect(getPosts).toHaveBeenCalledWith({ page: 1, pageSize: 8 });
    expect(getAllResources).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
      includeTags: true,
      type: 'wallpaper',
    });
    expect(container.textContent).toContain('组件渲染性能优化');
    expect(container.textContent).toContain('春日摄影之旅');
    expect(
      container.querySelector('[data-yuji-stage="wordmark"] a[href="/articles"]'),
    ).not.toBeNull();
    expect(container.querySelector('a[href="/articles/post-1"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="预览春日摄影之旅"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('keeps the wordmark stage independent from editorial cover data', async () => {
    const postsRequest = deferred<typeof postPayload>();
    getPosts.mockReturnValueOnce(postsRequest.promise);

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

    expect(container.querySelector('[data-yuji-stage="wordmark"] img')).toBeNull();

    await act(async () => {
      postsRequest.resolve(postPayload);
      await postsRequest.promise;
    });

    expect(container.querySelector('[data-yuji-stage="wordmark"] img')).toBeNull();
    expect(container.querySelector('.yuji-feature')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('uses a non-overlapping editorial image grid on the home page', async () => {
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

    expect(container.querySelector('.yuji-home-image-grid')).not.toBeNull();
    expect(container.querySelector('.yuji-image-composition')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('shows real error copy only after both content requests fail', async () => {
    getPosts.mockRejectedValueOnce(new Error('posts unavailable'));
    getAllResources.mockRejectedValueOnce(new Error('resources unavailable'));
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

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).toContain('文章暂时没有抵达。');
    expect(container.textContent).toContain('影像暂时没有抵达。');
    expect(container.querySelectorAll('button')).toHaveLength(2);

    act(() => root.unmount());
    container.remove();
  });

  it('retries only the failed home section without resetting successful content', async () => {
    getPosts
      .mockRejectedValueOnce(new Error('posts unavailable'))
      .mockResolvedValueOnce(postPayload);
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

    expect(container.textContent).toContain('春日摄影之旅');
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '重新试试',
    );
    await act(async () => {
      retry?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getPosts).toHaveBeenCalledTimes(2);
    expect(getAllResources).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('组件渲染性能优化');
    expect(container.textContent).toContain('春日摄影之旅');

    act(() => root.unmount());
    container.remove();
  });
});
