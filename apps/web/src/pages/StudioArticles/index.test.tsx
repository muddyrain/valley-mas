/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deletePost, getAdminPosts, toastError, toastSuccess } = vi.hoisted(() => ({
  deletePost: vi.fn(),
  getAdminPosts: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('@/api/blog', () => ({ deletePost, getAdminPosts }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载文章</div> : null),
}));
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="alertdialog">{children}</div> : null,
  AlertDialogAction: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props} />
  ),
  AlertDialogCancel: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props} />
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

import StudioArticles from '.';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function findPermanentDeleteButton() {
  return Array.from(document.body.querySelectorAll('button')).find(
    (button) => button.textContent === '永久删除',
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deletePost.mockResolvedValue(null);
  getAdminPosts.mockResolvedValue({
    list: [
      {
        id: '1',
        title: '旧博客',
        excerpt: '一篇仍在修改的文章。',
        cover: '/cover.webp',
        group: { name: 'React' },
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
  it('presents every authored content type as a cover-led article library', async () => {
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

    expect(container.textContent).toContain('文章库');
    expect(container.textContent).not.toContain('文章草稿');
    expect(container.textContent).toContain('旧博客');
    expect(container.textContent).toContain('旧图文');
    expect(container.textContent).toContain('未设置封面');
    expect(container.textContent).not.toContain('图文类型');
    expect(container.querySelector('img[src="/cover.webp"]')).not.toBeNull();
    expect(container.querySelector('option[value="archived"]')).not.toBeNull();
    expect(container.querySelector('a[href="/studio/articles/1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/my-space/image-text-edit/2"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="永久删除旧博客"]')).not.toBeNull();
    expect(getAdminPosts).toHaveBeenCalledWith(
      expect.not.objectContaining({ postType: expect.anything() }),
    );

    act(() => root.unmount());
    container.remove();
  });

  it('requires explicit confirmation before permanently deleting and then refreshes the list', async () => {
    getAdminPosts
      .mockResolvedValueOnce({
        list: [
          {
            id: '1',
            title: '准备删除的文章',
            postType: 'blog',
            status: 'draft',
            createdAt: '2026-08-14T00:00:00Z',
          },
        ],
        total: 1,
      })
      .mockResolvedValueOnce({ list: [], total: 0 });

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

    const deleteButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="永久删除准备删除的文章"]',
    );
    expect(deleteButton).not.toBeNull();
    act(() => deleteButton?.click());

    expect(document.body.textContent).toContain('永久删除这篇文章？');
    expect(document.body.textContent).toContain('文章及关联封面将永久删除，无法恢复。');

    const confirmButton = findPermanentDeleteButton();
    await act(async () => {
      confirmButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deletePost).toHaveBeenCalledWith('1');
    expect(getAdminPosts).toHaveBeenCalledTimes(2);
    expect(toastSuccess).toHaveBeenCalledWith('文章已永久删除');

    act(() => root.unmount());
    container.remove();
  });

  it('keeps the article and dialog available when permanent deletion fails', async () => {
    deletePost.mockRejectedValueOnce(new Error('delete unavailable'));
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

    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="永久删除旧博客"]')?.click(),
    );
    await act(async () => {
      findPermanentDeleteButton()?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toastError).toHaveBeenCalledWith('暂时无法删除文章，请稍后再试');
    expect(container.textContent).toContain('旧博客');
    expect(document.body.textContent).toContain('永久删除这篇文章？');
    expect(getAdminPosts).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it('moves to the previous page after deleting the final row on the current page', async () => {
    getAdminPosts
      .mockResolvedValueOnce({
        list: [
          {
            id: 'last-on-page',
            title: '第二页最后一篇',
            postType: 'blog',
            status: 'draft',
            createdAt: '2026-08-14T00:00:00Z',
          },
        ],
        total: 21,
      })
      .mockResolvedValueOnce({ list: [], total: 20 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/studio/articles?page=2']}>
          <StudioArticles />
          <LocationProbe />
        </MemoryRouter>,
      ),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="永久删除第二页最后一篇"]')
        ?.click(),
    );
    await act(async () => {
      findPermanentDeleteButton()?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deletePost).toHaveBeenCalledWith('last-on-page');
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/studio/articles',
    );
    expect(getAdminPosts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );

    act(() => root.unmount());
    container.remove();
  });
});
