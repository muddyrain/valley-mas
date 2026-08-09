import { describe, expect, it } from 'vitest';
import { toBlogPostListParams, toResourceListParams, toUserListParams } from './adminListParams.ts';

describe('admin list request parameters', () => {
  it('sends blog keywords and maps the shared type filter to postType', () => {
    expect(
      toBlogPostListParams({
        page: 3,
        pageSize: 20,
        keyword: 'architecture',
        status: 'draft',
        type: 'image_text',
      }),
    ).toEqual({
      page: 3,
      pageSize: 20,
      keyword: 'architecture',
      status: 'draft',
      postType: 'image_text',
    });
  });

  it('keeps user platform and role filters in the server request', () => {
    expect(
      toUserListParams({
        page: 2,
        pageSize: 10,
        keyword: 'alice',
        platform: 'wechat',
        role: 'admin',
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      keyword: 'alice',
      platform: 'wechat',
      role: 'admin',
    });
  });

  it('maps the shared type filter for resources', () => {
    expect(toResourceListParams({ page: 1, pageSize: 20, type: 'wallpaper' })).toEqual({
      page: 1,
      pageSize: 20,
      keyword: undefined,
      type: 'wallpaper',
    });
  });
});
