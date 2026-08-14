/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllResources } = vi.hoisted(() => ({ getAllResources: vi.fn() }));

let intersectionCallback: IntersectionObserverCallback | undefined;

vi.mock('@/api/resource', () => ({ getAllResources }));

import YujiGallery from '.';

const resourcePayload = {
  list: [
    {
      id: 'image-1',
      title: '海拉鲁远眺',
      url: '/one.webp',
      type: 'wallpaper',
      tags: ['远行'],
      width: 1600,
      height: 900,
    },
    {
      id: 'image-2',
      title: '春日头像',
      url: '/two.webp',
      type: 'avatar',
      tags: ['头像'],
      width: 900,
      height: 1350,
    },
  ],
  total: 2,
};

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
  getAllResources.mockReset();
  intersectionCallback = undefined;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  getAllResources.mockImplementation((params: { type?: string }) =>
    Promise.resolve({
      list: resourcePayload.list.filter((resource) => resource.type === params.type),
      total: resourcePayload.list.filter((resource) => resource.type === params.type).length,
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('YujiGallery', () => {
  it('shows a consumer-facing reveal state while gallery content is loading', async () => {
    vi.useFakeTimers();
    const resourcesRequest = deferred<typeof resourcePayload>();
    getAllResources.mockReturnValueOnce(resourcesRequest.promise);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <YujiGallery />
        </MemoryRouter>,
      ),
    );

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).not.toContain('主题合集');

    act(() => vi.advanceTimersByTime(300));
    expect(container.querySelector('[data-variant="gallery"]')).not.toBeNull();

    await act(async () => {
      resourcesRequest.resolve(resourcePayload);
      await resourcesRequest.promise;
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it('renders a flat masonry stream without inferred collection navigation', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter
          initialEntries={['/gallery?collection=%E9%A3%8E%E6%99%AF%E4%B8%8E%E6%83%B3%E8%B1%A1']}
        >
          <YujiGallery />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(getAllResources).toHaveBeenCalledWith({
      page: 1,
      pageSize: 24,
      includeTags: true,
      type: 'wallpaper',
    });
    expect(container.textContent).not.toContain('主题合集');
    expect(container.textContent).not.toContain('风景与想象');
    expect(container.textContent).toContain('海拉鲁远眺');
    expect(container.textContent).not.toContain('春日头像');
    expect(container.querySelector('a[href*="collection="]')).toBeNull();
    expect(container.querySelector('a[href="/gallery/image/image-1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/gallery/image/image-2"]')).toBeNull();
    expect(container.querySelector('[data-layout="stable-masonry"]')).not.toBeNull();
    expect(
      container
        .querySelector<HTMLImageElement>('img[src="/one.webp"]')
        ?.style.getPropertyValue('--yuji-image-transition-name'),
    ).toBe('yuji-image-image-1');
    expect(container.querySelector<HTMLImageElement>('img[src="/one.webp"]')?.width).toBe(1600);

    act(() => root.unmount());
    container.remove();
  });

  it('separates avatars from wallpapers with URL-backed navigation', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/gallery']}>
          <YujiGallery />
        </MemoryRouter>,
      ),
    );
    await flush();

    const avatarLink = container.querySelector<HTMLAnchorElement>('a[href="/gallery?type=avatar"]');
    expect(avatarLink).not.toBeNull();

    await act(async () => {
      avatarLink?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getAllResources).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 24,
      includeTags: true,
      type: 'avatar',
    });
    expect(container.textContent).toContain('春日头像');
    expect(container.textContent).not.toContain('海拉鲁远眺');
    expect(container.querySelector('[data-resource-type="avatar"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('loads the remaining gallery pages as the visitor approaches the end', async () => {
    const firstPage = Array.from({ length: 24 }, (_, index) => ({
      ...resourcePayload.list[0],
      id: `wallpaper-${index + 1}`,
      title: `壁纸 ${index + 1}`,
      url: `/wallpaper-${index + 1}.webp`,
    }));
    const lastResource = {
      ...resourcePayload.list[0],
      id: 'wallpaper-25',
      title: '壁纸 25',
      url: '/wallpaper-25.webp',
    };
    getAllResources
      .mockReset()
      .mockResolvedValueOnce({ list: firstPage, total: 25 })
      .mockResolvedValueOnce({ list: [lastResource], total: 25 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <YujiGallery />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(container.querySelectorAll('.yuji-gallery-item')).toHaveLength(24);
    expect(intersectionCallback).toBeTypeOf('function');
    const firstPageLanes = new Map(
      firstPage.map((resource) => [
        resource.id,
        container
          .querySelector(`a[href="/gallery/image/${resource.id}"]`)
          ?.closest<HTMLElement>('[data-masonry-column]')?.dataset.masonryColumn,
      ]),
    );

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getAllResources).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 24,
      includeTags: true,
      type: 'wallpaper',
    });
    expect(container.querySelectorAll('.yuji-gallery-item')).toHaveLength(25);
    expect(container.textContent).toContain('壁纸 25');
    for (const [resourceId, lane] of firstPageLanes) {
      expect(
        container
          .querySelector(`a[href="/gallery/image/${resourceId}"]`)
          ?.closest<HTMLElement>('[data-masonry-column]')?.dataset.masonryColumn,
      ).toBe(lane);
    }

    act(() => root.unmount());
    container.remove();
  });

  it('keeps the current gallery visible when a later page fails and retries only that page', async () => {
    const firstPage = Array.from({ length: 24 }, (_, index) => ({
      ...resourcePayload.list[0],
      id: `retry-wallpaper-${index + 1}`,
      title: `重试壁纸 ${index + 1}`,
      url: `/retry-wallpaper-${index + 1}.webp`,
    }));
    const lastResource = {
      ...resourcePayload.list[0],
      id: 'retry-wallpaper-25',
      title: '重试壁纸 25',
      url: '/retry-wallpaper-25.webp',
    };
    getAllResources
      .mockReset()
      .mockResolvedValueOnce({ list: firstPage, total: 25 })
      .mockRejectedValueOnce(new Error('next page unavailable'))
      .mockResolvedValueOnce({ list: [lastResource], total: 25 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <YujiGallery />
        </MemoryRouter>,
      ),
    );
    await flush();

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelectorAll('.yuji-gallery-item')).toHaveLength(24);
    const retryButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '重新试试',
    );
    expect(retryButton).not.toBeUndefined();

    await act(async () => {
      retryButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getAllResources).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 24,
      includeTags: true,
      type: 'wallpaper',
    });
    expect(container.querySelectorAll('.yuji-gallery-item')).toHaveLength(25);
    expect(container.textContent).toContain('重试壁纸 25');

    act(() => root.unmount());
    container.remove();
  });

  it('replaces the reveal state with an error only after loading fails', async () => {
    getAllResources.mockRejectedValueOnce(new Error('gallery unavailable'));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <MemoryRouter>
          <YujiGallery />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).toContain('影像暂时没有抵达。');
    expect(container.querySelector('button')?.textContent).toBe('重新试试');

    act(() => root.unmount());
    container.remove();
  });
});
