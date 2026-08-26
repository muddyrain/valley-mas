/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchPreviewMock } = vi.hoisted(() => ({ fetchPreviewMock: vi.fn() }));

vi.mock('@/api/blog', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/blog')>();
  return {
    ...original,
    fetchArticlePackagePreview: fetchPreviewMock,
    getArticlePackagePreviewURL: (postId: string, path: string) =>
      `/api/v1/public/blog/posts/id/${postId}/package/files?path=${encodeURIComponent(path)}`,
    requestArticlePackageDownload: vi.fn(),
  };
});

import { ArticlePackageSummaryCard } from './ArticlePackageSummaryCard';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('ArticlePackageSummaryCard', () => {
  it('在文章详情内原地展开预览并同步 file 查询参数', async () => {
    fetchPreviewMock.mockResolvedValue({
      blob: { text: () => Promise.resolve('# 使用说明') },
      contentType: 'text/markdown; charset=utf-8',
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/articles/601']}>
          <ArticlePackageSummaryCard
            postId="601"
            articlePackage={{
              id: '501',
              status: 'bound',
              originalName: '源码.zip',
              size: 1024,
              entryCount: 1,
              expandedSize: 2048,
              defaultPath: 'demo/README.md',
              collapsibleRoot: 'demo',
              updatedAt: '2026-08-26T08:00:00Z',
              entries: [
                {
                  path: 'demo/README.md',
                  previewKind: 'markdown',
                  mediaType: 'text/markdown; charset=utf-8',
                  size: 20,
                },
              ],
            }}
          />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain('预览文件');
    expect(container.querySelector('.yuji-package-browser')).toBeNull();

    const expandButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('预览文件'),
    );
    await act(async () => {
      expandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.yuji-package-browser')).not.toBeNull();
    expect(container.textContent).toContain('使用说明');
    expect(container.textContent).toContain('许可证以包内 LICENSE 或文章说明为准');
    expect(container.textContent).not.toContain('demo/README.md');
    expect(window.location.pathname).not.toContain('/package');
    expect(fetchPreviewMock).toHaveBeenCalledWith('601', 'demo/README.md');

    act(() => root.unmount());
  });

  it('没有 README 时只展示文件列表，等待访客选择', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/articles/602']}>
          <ArticlePackageSummaryCard
            postId="602"
            articlePackage={{
              id: '502',
              status: 'bound',
              originalName: '素材.zip',
              size: 2048,
              entryCount: 1,
              expandedSize: 4096,
              updatedAt: '2026-08-26T08:00:00Z',
              entries: [
                {
                  path: 'src/main.ts',
                  previewKind: 'text',
                  mediaType: 'text/plain; charset=utf-8',
                  size: 24,
                },
              ],
            }}
          />
        </MemoryRouter>,
      );
    });

    const expandButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('预览文件'),
    );
    await act(async () => {
      expandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('选择一个文件开始预览');
    expect(fetchPreviewMock).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it('即使旧清单标记为文本也不会请求敏感文件预览', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/articles/603?file=.env']}>
          <ArticlePackageSummaryCard
            postId="603"
            articlePackage={{
              id: '503',
              status: 'bound',
              originalName: '源码.zip',
              size: 1024,
              entryCount: 1,
              expandedSize: 1024,
              defaultPath: '.env',
              updatedAt: '2026-08-26T08:00:00Z',
              entries: [
                {
                  path: '.env',
                  previewKind: 'text',
                  mediaType: 'text/plain; charset=utf-8',
                  size: 24,
                },
              ],
            }}
          />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain('敏感文件已隐藏');
    expect(fetchPreviewMock).not.toHaveBeenCalled();

    act(() => root.unmount());
  });
});
