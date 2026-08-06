import { describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/utils/request', () => ({
  default: {
    get: getMock,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAdminPosts } from './blog';

describe('api/blog', () => {
  it('passes sort param to getAdminPosts', async () => {
    getMock.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 12 });

    await getAdminPosts({
      page: 2,
      pageSize: 12,
      postType: 'blog',
      groupId: '2',
      sort: 'created',
    });

    expect(getMock).toHaveBeenCalledWith('/admin/blog/posts', {
      params: {
        page: 2,
        pageSize: 12,
        postType: 'blog',
        groupId: '2',
        sort: 'created',
      },
    });
  });
});
