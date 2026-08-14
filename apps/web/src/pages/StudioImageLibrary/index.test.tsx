/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyResources, deleteResource } = vi.hoisted(() => ({
  getMyResources: vi.fn(),
  deleteResource: vi.fn(),
}));

interface TestResource {
  id: string;
  title: string;
}

interface ResourceCardMockProps {
  resource: TestResource;
  onClick: (resource: TestResource) => void;
  onEdit: (resource: TestResource) => void;
  onDelete: (resource: TestResource) => void;
}

vi.mock('@/api/resource', async () => {
  const actual = await vi.importActual<typeof import('@/api/resource')>('@/api/resource');
  return {
    ...actual,
    getMyResources,
    deleteResource,
  };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/components/ResourceCard', () => ({
  default: ({ resource, onClick, onEdit, onDelete }: ResourceCardMockProps) => (
    <article>
      <button type="button" onClick={() => onClick(resource)}>
        {resource.title}
      </button>
      <button type="button" aria-label={`编辑 ${resource.title}`} onClick={() => onEdit(resource)}>
        编辑
      </button>
      <button
        type="button"
        aria-label={`删除 ${resource.title}`}
        onClick={() => onDelete(resource)}
      >
        删除
      </button>
    </article>
  ),
  ResourceCardSkeleton: () => <div>图片加载占位</div>,
}));

vi.mock('@/components/EditResourceDialog', () => ({
  default: ({ resource }: { resource: TestResource | null }) =>
    resource ? <div role="dialog">编辑图片：{resource.title}</div> : null,
}));

import StudioImageLibrary from './index';

const resources = [
  {
    id: 'wallpaper-1',
    title: '山间壁纸',
    type: 'wallpaper',
    visibility: 'public',
    url: 'https://example.com/wallpaper.jpg',
    thumbnailUrl: 'https://example.com/wallpaper-thumb.jpg',
    size: 100,
    width: 1600,
    height: 900,
    extension: 'jpg',
    downloadCount: 4,
    createdAt: '2026-08-15T00:00:00Z',
    storageKey: 'wallpaper.jpg',
    tags: ['风景'],
  },
  {
    id: 'avatar-1',
    title: '雨头像',
    type: 'avatar',
    visibility: 'private',
    url: 'https://example.com/avatar.jpg',
    thumbnailUrl: 'https://example.com/avatar-thumb.jpg',
    size: 50,
    width: 512,
    height: 512,
    extension: 'jpg',
    downloadCount: 0,
    createdAt: '2026-08-14T00:00:00Z',
    storageKey: 'avatar.jpg',
    tags: [],
  },
];

async function renderPage(path = '/studio/images/library') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <StudioImageLibrary />
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  return { container, root };
}

describe('StudioImageLibrary', () => {
  beforeEach(() => {
    getMyResources.mockReset();
    deleteResource.mockReset();
    getMyResources.mockResolvedValue({ list: resources, total: 53 });
    deleteResource.mockResolvedValue(undefined);
  });

  it('loads all of the owner images with pagination instead of a recent wallpaper subset', async () => {
    const { container, root } = await renderPage();

    expect(getMyResources).toHaveBeenCalledWith({
      page: 1,
      pageSize: 24,
      type: undefined,
      visibility: undefined,
    });
    expect(container.textContent).toContain('山间壁纸');
    expect(container.textContent).toContain('雨头像');
    expect(container.textContent).toContain('共 53 张');
    expect(container.textContent).toContain('第 1 / 3 页');

    act(() => root.unmount());
    container.remove();
  });

  it('keeps type and visibility filters in the URL-backed request', async () => {
    const { container, root } = await renderPage(
      '/studio/images/library?type=avatar&visibility=private&page=2',
    );

    expect(getMyResources).toHaveBeenCalledWith({
      page: 2,
      pageSize: 24,
      type: 'avatar',
      visibility: 'private',
    });

    act(() => root.unmount());
    container.remove();
  });

  it('opens the editable image detail from the card', async () => {
    const { container, root } = await renderPage();

    const cardButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '山间壁纸',
    );
    await act(async () => cardButton?.click());

    expect(container.textContent).toContain('编辑图片：山间壁纸');

    act(() => root.unmount());
    container.remove();
  });

  it('asks for confirmation before deleting an image', async () => {
    const { container, root } = await renderPage();

    const deleteButton = container.querySelector('button[aria-label="删除 山间壁纸"]');
    await act(async () => deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.textContent).toContain('确认删除这张图片？');
    expect(deleteResource).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it('deletes the selected image only after confirmation and refreshes the page', async () => {
    const { container, root } = await renderPage();

    const deleteButton = container.querySelector('button[aria-label="删除 山间壁纸"]');
    await act(async () => deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const confirmButton = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('删除图片'),
    );
    await act(async () => {
      confirmButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteResource).toHaveBeenCalledWith('wallpaper-1');
    expect(getMyResources).toHaveBeenCalledTimes(2);

    act(() => root.unmount());
    container.remove();
  });
});
