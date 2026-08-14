/** @vitest-environment jsdom */

import type { InputHTMLAttributes, ReactNode } from 'react';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPosts, getAllResources, navigate, authState } = vi.hoisted(() => ({
  getPosts: vi.fn(),
  getAllResources: vi.fn(),
  navigate: vi.fn(),
  authState: { isAuthenticated: false },
}));

vi.mock('@/api/blog', () => ({ getPosts }));
vi.mock('@/api/resource', () => ({ getAllResources }));
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));
vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CommandDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        <button type="button" onClick={() => onOpenChange?.(false)}>
          关闭面板
        </button>
      </div>
    ) : null,
  CommandInput: ({
    onValueChange,
    ...props
  }: InputHTMLAttributes<HTMLInputElement> & {
    onValueChange?: (value: string) => void;
  }) => (
    <input
      {...props}
      onChange={(event) => {
        props.onChange?.(event);
        onValueChange?.(event.currentTarget.value);
      }}
    />
  ),
  CommandList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children, heading }: { children?: ReactNode; heading?: ReactNode }) => (
    <section>
      <h2>{heading}</h2>
      {children}
    </section>
  ),
  CommandItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  CommandShortcut: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  CommandSeparator: () => <hr />,
}));

import { GlobalCommandPalette } from './GlobalCommandPalette';

function PaletteHarness() {
  const [open, setOpen] = useState(false);
  return <GlobalCommandPalette open={open} onOpenChange={setOpen} />;
}

function renderPalette() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<PaletteHarness />));
  return { container, root };
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

function typeInto(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  authState.isAuthenticated = false;
  getPosts.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 5 });
  getAllResources.mockResolvedValue({ list: [], total: 0 });
});

describe('GlobalCommandPalette', () => {
  it.each([
    ['Ctrl+K', { ctrlKey: true }],
    ['Meta+K', { metaKey: true }],
  ])('opens with %s and prevents the browser shortcut', (_label, modifiers) => {
    const { container, root } = renderPalette();
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      bubbles: true,
      cancelable: true,
      ...modifiers,
    });

    act(() => document.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    cleanup(container, root);
  });

  it('closes on Escape and does not search remotely for an empty query', () => {
    const { container, root } = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(getPosts).not.toHaveBeenCalled();
    expect(getAllResources).not.toHaveBeenCalled();
    cleanup(container, root);
  });

  it('debounces and runs content and resource searches together', async () => {
    const { container, root } = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => typeInto(input, '星河'));
    expect(getPosts).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(280);
    });

    expect(getPosts).toHaveBeenCalledWith({ keyword: '星河', page: 1, pageSize: 5 });
    expect(getAllResources).toHaveBeenCalledWith({ keyword: '星河', page: 1, pageSize: 5 });
    cleanup(container, root);
  });

  it('announces loading and empty states accessibly', async () => {
    const pending = deferred<{ list: never[]; total: number }>();
    getPosts.mockReturnValue(pending.promise);
    getAllResources.mockReturnValue(pending.promise);
    const { container, root } = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );
    act(() => typeInto(container.querySelector('input') as HTMLInputElement, '无匹配'));
    await act(async () => vi.advanceTimersByTimeAsync(280));

    expect(container.querySelector('[role="status"]')?.textContent).toContain('正在搜索');

    await act(async () => {
      pending.resolve({ list: [], total: 0 });
      await Promise.resolve();
    });
    expect(
      Array.from(container.querySelectorAll('[role="status"]')).some((node) =>
        node.textContent?.includes('没有找到相关内容'),
      ),
    ).toBe(true);
    cleanup(container, root);
  });

  it('keeps successful content visible when resources fail', async () => {
    getPosts.mockResolvedValue({
      list: [{ id: 'post-1', title: '星河文章', postType: 'blog' }],
      total: 1,
      page: 1,
      pageSize: 5,
    });
    getAllResources.mockRejectedValue(new Error('resource unavailable'));
    const { container, root } = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );

    act(() => typeInto(container.querySelector('input') as HTMLInputElement, '星河'));
    await act(async () => vi.advanceTimersByTimeAsync(280));

    expect(container.textContent).toContain('星河文章');
    expect(container.textContent).toContain('资源结果暂时无法加载');
    cleanup(container, root);
  });

  it('ignores stale responses from an older query', async () => {
    const older = deferred<{
      list: Array<{ id: string; title: string; postType: string }>;
      total: number;
    }>();
    const newer = deferred<{
      list: Array<{ id: string; title: string; postType: string }>;
      total: number;
    }>();
    getPosts.mockImplementation(({ keyword }: { keyword: string }) =>
      keyword === '旧词' ? older.promise : newer.promise,
    );
    const { container, root } = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => typeInto(input, '旧词'));
    await act(async () => vi.advanceTimersByTimeAsync(280));
    act(() => typeInto(input, '新词'));
    await act(async () => vi.advanceTimersByTimeAsync(280));

    await act(async () => {
      newer.resolve({ list: [{ id: 'new', title: '新结果', postType: 'blog' }], total: 1 });
      await Promise.resolve();
    });
    await act(async () => {
      older.resolve({ list: [{ id: 'old', title: '旧结果', postType: 'blog' }], total: 1 });
      await Promise.resolve();
    });

    expect(container.textContent).toContain('新结果');
    expect(container.textContent).not.toContain('旧结果');
    cleanup(container, root);
  });

  it.each([
    [
      'article',
      { post: { id: 'post-7', title: '文章结果', postType: 'blog' } },
      '/blog/post-7',
      '文章结果',
    ],
    [
      'resource',
      { resource: { id: 'resource-8', title: '资源结果', type: 'wallpaper', url: '/r.png' } },
      '/resource/resource-8',
      '资源结果',
    ],
  ])('navigates to the selected %s result and closes', async (_kind, fixture, expectedPath, label) => {
    if ('post' in fixture) {
      getPosts.mockResolvedValue({ list: [fixture.post], total: 1 });
    }
    if ('resource' in fixture) {
      getAllResources.mockResolvedValue({ list: [fixture.resource], total: 1 });
    }
    const { container, root } = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );
    act(() => typeInto(container.querySelector('input') as HTMLInputElement, '结果'));
    await act(async () => vi.advanceTimersByTimeAsync(280));

    const button = Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent?.includes(label),
    );
    act(() => button?.click());

    expect(navigate).toHaveBeenCalledWith(expectedPath);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    cleanup(container, root);
  });

  it('navigates to a local page command and closes', () => {
    const { container, root } = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );

    const articlesButton = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === '文章',
    );
    act(() => articlesButton?.click());

    expect(navigate).toHaveBeenCalledWith('/articles');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    cleanup(container, root);
  });

  it('navigates to an encoded full-results URL and closes', async () => {
    const { container, root } = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );
    act(() => typeInto(container.querySelector('input') as HTMLInputElement, '壁纸 & 头像'));
    await act(async () => vi.advanceTimersByTimeAsync(280));

    const button = Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('查看全部关于'),
    );
    act(() => button?.click());

    expect(navigate).toHaveBeenCalledWith('/search?q=%E5%A3%81%E7%BA%B8+%26+%E5%A4%B4%E5%83%8F');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    cleanup(container, root);
  });

  it('hides personal commands until the user is authenticated', () => {
    const signedOut = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );
    expect(signedOut.container.textContent).not.toContain('文章库');
    cleanup(signedOut.container, signedOut.root);

    authState.isAuthenticated = true;
    const signedIn = renderPalette();
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      ),
    );
    expect(signedIn.container.textContent).toContain('文章库');
    cleanup(signedIn.container, signedIn.root);
  });
});
