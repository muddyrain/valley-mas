import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBlogPost,
  getBlogPostDetail,
  listBlogCategories,
  listBlogGroups,
  listBlogPosts,
  listBlogTags,
  uploadBlogCover,
} from '../src/api/blog';

describe('desktop blog api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists public published blog posts with fixed blog type query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: { list: [], total: 0, page: 2, pageSize: 12 },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listBlogPosts({
      page: 2,
      pageSize: 12,
      keyword: 'garden notes',
      groupId: '101',
      category: 'life',
      tag: 'daily',
      sort: 'oldest',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/public/blog/posts?page=2&pageSize=12&postType=blog&keyword=garden+notes&groupId=101&category=life&tag=daily&sort=oldest',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(result).toMatchObject({ list: [], total: 0, page: 2, pageSize: 12 });
  });

  it('opens blog detail and taxonomy through public endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'ok',
            data: [],
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getBlogPostDetail('301');
    await listBlogGroups();
    await listBlogCategories();
    await listBlogTags();

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:8080/api/v1/public/blog/posts/id/301',
      'http://localhost:8080/api/v1/public/blog/groups?groupType=blog',
      'http://localhost:8080/api/v1/public/blog/categories',
      'http://localhost:8080/api/v1/public/blog/tags',
    ]);
  });

  it('surfaces api errors from the shared desktop client', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 500, message: 'blog unavailable', data: null })),
        ),
    );

    await expect(listBlogPosts()).rejects.toThrow('blog unavailable');
  });

  it('creates blog posts through the authenticated admin endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: { id: '701', title: 'New blog', content: '# New blog' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createBlogPost(
      {
        title: 'New blog',
        postType: 'blog',
        visibility: 'public',
        content: '# New blog',
        tagIds: ['3', '5'],
        status: 'published',
        publishNow: true,
      },
      'desktop-token',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/admin/blog/posts',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          title: 'New blog',
          postType: 'blog',
          visibility: 'public',
          content: '# New blog',
          tagIds: ['3', '5'],
          status: 'published',
          publishNow: true,
        }),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer desktop-token');
  });

  it('uploads blog covers as authenticated multipart form data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            url: 'https://cdn.example.com/cover.png',
            storageKey: 'blog/cover.png',
            fileName: 'cover.png',
            size: 128,
            width: 16,
            height: 16,
            extension: '.png',
            contentType: 'image/png',
          },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['cover'], 'cover.png', { type: 'image/png' });
    const result = await uploadBlogCover(file, 'desktop-token');

    expect(result).toMatchObject({ url: 'https://cdn.example.com/cover.png' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/admin/blog/cover/upload',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.any(FormData),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as HeadersInit;
    expect(headers).toMatchObject({ Authorization: 'Bearer desktop-token' });
  });
});
