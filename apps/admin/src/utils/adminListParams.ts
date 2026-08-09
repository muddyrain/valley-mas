import type { PostListParams, PostType } from '@/api/blog';
import type { ResourceListParams, ResourceType } from '@/api/resource';
import type { UserListParams } from '@/api/user';
import type { AdminListParams } from '@/types/api';

export function toBlogPostListParams(params: AdminListParams): PostListParams {
  const postType: PostType | undefined =
    params.type === 'blog' || params.type === 'image_text' ? params.type : undefined;

  return {
    page: params.page,
    pageSize: params.pageSize,
    keyword: params.keyword,
    status: params.status,
    postType,
  };
}

export function toUserListParams(params: AdminListParams): UserListParams {
  return {
    page: params.page,
    pageSize: params.pageSize,
    keyword: params.keyword,
    platform: params.platform,
    role: params.role,
  };
}

export function toResourceListParams(params: AdminListParams): ResourceListParams {
  const type: ResourceType | undefined =
    params.type === 'avatar' || params.type === 'wallpaper' ? params.type : undefined;

  return {
    page: params.page,
    pageSize: params.pageSize,
    keyword: params.keyword,
    type,
  };
}
