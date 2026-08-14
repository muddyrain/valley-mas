/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

import YujiSearch from '.';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderSearch(path: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/search"
            element={
              <>
                <YujiSearch />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  });
  return { container, root };
}

beforeEach(() => {
  vi.clearAllMocks();
  getPosts.mockResolvedValue({ list: [], total: 0 });
  getAllResources.mockResolvedValue({ list: [], total: 0 });
});

describe('YujiSearch', () => {
  it('restores article search state from the URL without querying private page commands', async () => {
    getPosts.mockResolvedValue({
      list: [{ id: 'post-1', title: 'React 边界', excerpt: '一篇文章', createdAt: '2026-08-01' }],
      total: 1,
    });
    const { container, root } = renderSearch('/search?q=React&type=articles&page=2');
    await flush();

    expect(getPosts).toHaveBeenCalledWith({ keyword: 'React', page: 2, pageSize: 12 });
    expect(getAllResources).not.toHaveBeenCalled();
    expect(container.textContent).toContain('React 边界');
    expect(container.textContent).not.toContain('页面与功能');
    expect(container.querySelector('a[href="/articles/post-1"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('does not call remote APIs until a search term is provided', async () => {
    const { container, root } = renderSearch('/search');
    await flush();

    expect(getPosts).not.toHaveBeenCalled();
    expect(getAllResources).not.toHaveBeenCalled();
    expect(container.textContent).toContain('从文章与影像中寻找');

    act(() => root.unmount());
    container.remove();
  });
});
