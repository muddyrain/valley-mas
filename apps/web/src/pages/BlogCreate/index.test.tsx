/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const blogApi = vi.hoisted(() => ({
  createPost: vi.fn(),
  getAdminGroups: vi.fn(),
  getAdminPostDetail: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock('@/api/blog', () => ({
  createPost: blogApi.createPost,
  createGroup: vi.fn(),
  getAdminGroups: blogApi.getAdminGroups,
  getAdminPostDetail: blogApi.getAdminPostDetail,
  updatePost: blogApi.updatePost,
  generateBlogExcerpt: vi.fn(),
  pickBlogCoverFromResources: vi.fn(),
  triggerUnsplashDownload: vi.fn(),
  uploadBlogCover: vi.fn(),
  uploadBlogCoverByUrl: vi.fn(),
}));
vi.mock('@/api/aiImages', () => ({
  createAIImageGeneration: vi.fn(),
  getAIImageGeneration: vi.fn(),
}));
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: () => ({ isAuthenticated: true, user: { id: 'owner-1' } }),
}));
vi.mock('@/components/blog', () => ({
  BLOG_COVER_OUTPUT_HEIGHT: 630,
  BLOG_COVER_OUTPUT_WIDTH: 1200,
}));
vi.mock('@/components/blog/AICoverAssistantDialog', () => ({
  BLOG_COVER_AI_ASPECT_RATIO: '16:9',
  BLOG_COVER_AI_QUALITY: '1K',
  AICoverAssistantDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));
vi.mock('@/components/blog/BatchMarkdownImportDialog', () => ({
  BatchMarkdownImportDialog: () => null,
}));
vi.mock('@/components/blog/BlogCoverPreview', () => ({ BlogCoverPreview: () => null }));
vi.mock('@/components/blog/BlogWorkflowDialog', () => ({ BlogWorkflowDialog: () => null }));
vi.mock('@/components/blog/CoverCropDialog', () => ({ CoverCropDialog: () => null }));
vi.mock('@/components/blog/CoverPickerDialog', () => ({ CoverPickerDialog: () => null }));
vi.mock('@/components/blog/MdxMarkdownEditor', () => ({
  MdxMarkdownEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea aria-label="正文" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock('@/components/BlockingLoadingSurface', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/utils/navigation', () => ({ navigateBackOrFallback: vi.fn() }));

import BlogCreate from '.';

function changeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  blogApi.getAdminGroups.mockResolvedValue([{ id: 'react', name: 'React' }]);
  blogApi.createPost.mockResolvedValue({ id: 'post-1' });
});

describe('BlogCreate studio article flow', () => {
  it('opens a publish review before the final publish request', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/studio/articles/new']}>
          <Routes>
            <Route path="/studio/articles/new" element={<BlogCreate />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => Promise.resolve());

    const title = container.querySelector('input[placeholder*="标题"]');
    const content = container.querySelector('textarea[aria-label="正文"]');
    changeValue(title as HTMLInputElement, '一篇待发布的文章');
    changeValue(content as HTMLTextAreaElement, '## 正文\n\n这是正文内容。');

    const reviewButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '发布检查',
    );
    expect(reviewButton).toBeDefined();
    act(() => reviewButton?.click());
    expect(blogApi.createPost).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('确认发布');

    const confirmButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '确认发布',
    );
    await act(async () => confirmButton?.click());
    expect(blogApi.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '一篇待发布的文章',
        groupId: undefined,
        status: 'published',
        publishNow: true,
      }),
    );

    act(() => root.unmount());
    container.remove();
  });
});
