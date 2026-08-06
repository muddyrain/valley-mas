/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MyPosts from './index';

const { getAdminPosts } = vi.hoisted(() => ({
  getAdminPosts: vi.fn(),
}));

vi.mock('@/api/blog', () => ({
  batchPublishPosts: vi.fn(),
  deletePost: vi.fn(),
  getAdminGroups: vi.fn().mockResolvedValue([]),
  getAdminPosts,
  updatePost: vi.fn(),
  uploadBlogCover: vi.fn(),
  uploadBlogCoverByUrl: vi.fn(),
  type: {},
  visibility: {},
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: true,
  })),
}));

vi.mock('@/hooks/useUrlPaginationQuery', () => ({
  numberParam: vi.fn(),
  stringParam: vi.fn(),
  useUrlQueryState: vi.fn(() => ({
    values: {
      blogPage: 1,
      imageTextPage: 1,
      blogGroupId: '',
      imageTextGroupId: '',
    },
    setValue: vi.fn(),
  })),
  useUrlPaginationQuery: vi.fn(),
}));

vi.mock('@/components/blog', () => ({
  BlogPostCard: () => <div>博客卡片</div>,
  ImageTextPostCard: () => <div>图文卡片</div>,
}));

vi.mock('@/components/blog/BatchMarkdownImportDialog', () => ({
  BatchMarkdownImportDialog: () => <div />,
}));

vi.mock('@/components/blog/BlogSortDialog', () => ({
  default: () => <div />,
}));

vi.mock('@/components/blog/BlogWorkflowDialog', () => ({
  BlogWorkflowDialog: () => <div />,
}));

vi.mock('@/components/blog/PostGroupDropdown', () => ({
  default: () => <div />,
}));

vi.mock('@/components/blog/PublicWallpaperPickerDialog', () => ({
  PublicWallpaperPickerDialog: () => <div />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MyPosts', () => {
  it('loads blog list with sort=created', async () => {
    const blogData = {
      list: [
        {
          id: '1',
          title: '文章A',
          postType: 'blog',
          excerpt: '',
          groupId: '1',
          status: 'draft',
          viewCount: 0,
          likeCount: 0,
          isTop: false,
          sortOrder: 1,
          groupSortOrder: 0,
          createdAt: '2026-08-06T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 12,
    };

    const imageTextData = { list: [], total: 0, page: 1, pageSize: 4 };

    getAdminPosts.mockResolvedValueOnce(blogData).mockResolvedValueOnce(imageTextData);

    const rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <MyPosts />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getAdminPosts).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 12,
      postType: 'blog',
      groupId: undefined,
      sort: 'created',
    });

    expect(getAdminPosts).toHaveBeenNthCalledWith(2, {
      page: 1,
      pageSize: 4,
      postType: 'image_text',
      groupId: undefined,
    });

    root.unmount();
    rootElement.remove();
  });
});
