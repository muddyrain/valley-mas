import { describe, expect, it, vi } from 'vitest';

const { getMock, postMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock('@/utils/request', () => ({
  default: {
    get: getMock,
    post: postMock,
    put: putMock,
    delete: vi.fn(),
  },
}));

import {
  confirmArticlePackage,
  createArticlePackageUpload,
  getAdminPosts,
  updatePostArticlePackage,
} from './blog';

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

  it('uses the article package upload, confirmation and binding contracts', async () => {
    postMock.mockResolvedValue({});
    putMock.mockResolvedValue({});

    await createArticlePackageUpload('源码.zip', 1024);
    await confirmArticlePackage('501');
    await updatePostArticlePackage('601', 'replace', '501');

    expect(postMock).toHaveBeenCalledWith('/admin/blog/article-packages/uploads', {
      originalName: '源码.zip',
      size: 1024,
    });
    expect(postMock).toHaveBeenCalledWith('/admin/blog/article-packages/501/confirm', {});
    expect(putMock).toHaveBeenCalledWith('/admin/blog/posts/601/article-package', {
      action: 'replace',
      packageId: '501',
    });
  });
});
