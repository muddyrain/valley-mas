/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPosts, getAllResources, authState } = vi.hoisted(() => ({
  getPosts: vi.fn(),
  getAllResources: vi.fn(),
  authState: { isAuthenticated: false },
}));

vi.mock('@/api/blog', () => ({ getPosts }));
vi.mock('@/api/resource', () => ({ getAllResources }));
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));
vi.mock('@/components/blog', () => ({
  BlogFeedCard: ({ post }: { post: { id: string; title: string } }) => (
    <a href={`/blog/${post.id}`}>{post.title}</a>
  ),
}));
vi.mock('@/components/ResourceCard', () => ({
  default: ({ resource }: { resource: { id: string; title: string } }) => (
    <a href={`/resource/${resource.id}`}>{resource.title}</a>
  ),
}));

import SearchPage from '.';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderSearch(initialEntry: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/search"
            element={
              <>
                <SearchPage />
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

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = false;
  getPosts.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 12 });
  getAllResources.mockResolvedValue({ list: [], total: 0 });
});

describe('SearchPage', () => {
  it('restores q, type and page from the URL and sends content pagination correctly', async () => {
    const { container, root } = renderSearch(
      '/search?q=%E5%B7%A5%E4%BD%9C%E6%B5%81&type=content&page=2',
    );
    await flush();

    expect((container.querySelector('input[type="search"]') as HTMLInputElement).value).toBe(
      '工作流',
    );
    expect(getPosts).toHaveBeenCalledWith({ keyword: '工作流', page: 2, pageSize: 12 });
    expect(getAllResources).not.toHaveBeenCalled();
    cleanup(container, root);
  });

  it('does not request remote APIs for an empty query and shows safe common pages', async () => {
    const { container, root } = renderSearch('/search');
    await flush();

    expect(getPosts).not.toHaveBeenCalled();
    expect(getAllResources).not.toHaveBeenCalled();
    expect(container.textContent).toContain('搜索文章、图文、资源和页面');
    expect(container.textContent).toContain('常用页面');
    expect(container.textContent).not.toContain('没有找到相关内容');
    cleanup(container, root);
  });

  it('loads content and resources independently in the all view', async () => {
    getPosts.mockResolvedValue({
      list: [{ id: 'post-1', title: '工作流文章', postType: 'blog' }],
      total: 9,
      page: 1,
      pageSize: 6,
    });
    getAllResources.mockRejectedValue(new Error('resource unavailable'));
    const { container, root } = renderSearch('/search?q=%E5%B7%A5%E4%BD%9C%E6%B5%81');
    await flush();

    expect(getPosts).toHaveBeenCalledWith({ keyword: '工作流', page: 1, pageSize: 6 });
    expect(getAllResources).toHaveBeenCalledWith({ keyword: '工作流', page: 1, pageSize: 6 });
    expect(container.textContent).toContain('工作流文章');
    expect(container.textContent).toContain('资源结果暂时无法加载');
    expect(container.textContent).toContain('内容（9）');
    cleanup(container, root);
  });

  it('uses independent resource pagination parameters', async () => {
    const { container, root } = renderSearch('/search?q=%E5%A3%81%E7%BA%B8&type=resources&page=3');
    await flush();

    expect(getAllResources).toHaveBeenCalledWith({ keyword: '壁纸', page: 3, pageSize: 12 });
    expect(getPosts).not.toHaveBeenCalled();
    cleanup(container, root);
  });

  it('shows a query-specific empty result without treating loading as empty', async () => {
    const { container, root } = renderSearch('/search?q=%E4%B8%8D%E5%AD%98%E5%9C%A8&type=content');
    expect(container.textContent).not.toContain('没有找到与“不存在”相关的内容');
    await flush();

    expect(container.textContent).toContain('没有找到与“不存在”相关的内容');
    cleanup(container, root);
  });

  it('filters page commands locally without remote requests', async () => {
    const { container, root } = renderSearch('/search?q=%E7%8E%A9%E5%85%B7&type=pages');
    await flush();

    expect(container.textContent).toContain('玩具攀爬实验场');
    expect(getPosts).not.toHaveBeenCalled();
    expect(getAllResources).not.toHaveBeenCalled();
    cleanup(container, root);
  });

  it('resets page when the search word changes', async () => {
    const { container, root } = renderSearch('/search?q=%E6%97%A7%E8%AF%8D&type=content&page=4');
    await flush();
    const input = container.querySelector('input[type="search"]') as HTMLInputElement;

    act(() => setInputValue(input, '新词'));
    act(() =>
      input
        .closest('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/search?q=%E6%96%B0%E8%AF%8D&type=content',
    );
    cleanup(container, root);
  });

  it('resets page when switching result type', async () => {
    const { container, root } = renderSearch('/search?q=%E5%A3%81%E7%BA%B8&type=content&page=2');
    await flush();
    const resourcesTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (item) => item.textContent === '资源',
    ) as HTMLElement | undefined;

    act(() => resourcesTab?.click());

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/search?q=%E5%A3%81%E7%BA%B8&type=resources',
    );
    cleanup(container, root);
  });
});
