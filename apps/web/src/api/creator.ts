import http from '@/utils/request';
import type { MyResource } from './resource';

// 创作者类型
export interface Creator {
  id: string;
  code: string; // 创作者口令
  name: string;
  avatar: string;
  description: string;
  resourceCount: number;
  downloadCount: number;
  followerCount: number;
  createdAt: string;
}

// 创作者空间响应类型
interface CreatorSpaceResponse {
  creator: {
    id: string;
    code: string;
    name: string;
    avatar: string;
    description: string;
    createdAt?: string;
  };
  stats: {
    totalViews: number;
    totalDownloads: number;
    resourceCount: number;
    followerCount: number;
  };
  space?: {
    id: string;
    description: string;
    banner: string;
  };
  resources?: Resource[];
}

// 资源类型
export interface Resource {
  id: string;
  title: string;
  url: string;
  type: string;
  downloadCount: number;
  userId: string;
  creatorName: string;
  isTop: boolean;
  /** 当前用户是否已收藏（仅登录用户时服务端返回 true/false，未登录为 false） */
  isFavorited?: boolean;
  tags?: Array<{ id: string; name: string }>;
}

// 专辑类型
export interface Album {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  coverResourceId?: string;
  resourceCount: number;
  creatorId: string;
  resources?: Array<
    Pick<MyResource, 'id' | 'title' | 'url' | 'type'> & {
      visibility?: string;
    }
  >;
}

export interface MyFollowItem {
  id: string;
  userId: string;
  creatorId: string;
  createdAt: string;
  creator?: {
    id: string;
    userId: string;
    code: string;
    description: string;
    createdAt: string;
    user?: {
      nickname: string;
      avatar: string;
    };
  };
}

// 列表响应类型
interface ListResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 获取热门创作者
export const getHotCreators = (page = 1, pageSize = 10) => {
  return http.get<unknown, ListResponse<Creator>>(
    `/public/hot-creators?page=${page}&pageSize=${pageSize}`,
  );
};

// 公开创作者检索（支持关键词 + 分页）
export const searchPublicCreators = (
  params: { page?: number; pageSize?: number; keyword?: string } = {},
) => {
  const { page = 1, pageSize = 20, keyword } = params;
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (keyword) query.set('keyword', keyword);
  return http.get<unknown, ListResponse<Creator>>(`/public/creators?${query.toString()}`);
};

// 获取创作者详情
export const getCreatorByCode = async (code: string): Promise<Creator> => {
  const response = await http.get<unknown, CreatorSpaceResponse>(`/public/space/${code}`);
  // 适配后端返回的数据结构
  if (response.creator) {
    // 公开详情接口现在直接返回粉丝数，避免详情页先展示 0 再被关注状态接口覆盖。
    return {
      id: response.creator.id,
      code: response.creator.code,
      name: response.creator.name,
      avatar: response.creator.avatar,
      description: response.creator.description,
      resourceCount: response.stats?.resourceCount || 0,
      downloadCount: response.stats?.totalDownloads || 0,
      followerCount: response.stats.followerCount || 0,
      createdAt: response.creator.createdAt || '',
    };
  }
  throw new Error('创作者数据格式错误');
};

// 获取创作者作品
export const getCreatorWorks = (
  creatorId: string,
  params: {
    page?: number;
    pageSize?: number;
    type?: string; // 资源类型: avatar/wallpaper
    keyword?: string;
    albumId?: string;
  } = {},
) => {
  const { page = 1, pageSize = 20, type, keyword, albumId } = params;
  let url = `/public/creators/${creatorId}/resources?page=${page}&pageSize=${pageSize}`;
  if (type) url += `&type=${type}`;
  if (keyword) url += `&keyword=${keyword}`;
  if (albumId) url += `&albumId=${albumId}`;

  return http.get<unknown, ListResponse<Resource>>(url);
};

// 获取创作者专辑
export const getCreatorAlbums = (
  creatorId: string,
  params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
  } = {},
) => {
  const { page = 1, pageSize = 20, keyword } = params;
  let url = `/public/creator/${creatorId}/albums?page=${page}&pageSize=${pageSize}`;
  if (keyword) url += `&keyword=${keyword}`;

  return http.get<unknown, ListResponse<Album>>(url);
};

export const getMyCreatorAlbums = () => {
  return http.get<unknown, { list: Album[]; total: number }>('/creator/albums');
};

export const createCreatorAlbum = (data: {
  name: string;
  description?: string;
  coverResourceId?: string;
  resourceIds: string[];
}) => {
  return http.post<unknown, Album>('/creator/albums', data);
};

export const updateCreatorAlbum = (
  id: string,
  data: {
    name: string;
    description?: string;
    coverResourceId?: string;
    resourceIds: string[];
  },
) => {
  return http.put<unknown, Album>(`/creator/albums/${id}`, data);
};

export const deleteCreatorAlbum = (id: string) => {
  return http.delete<unknown, { ok: boolean }>(`/creator/albums/${id}`);
};

// 关注创作者
export const followCreator = (creatorId: string) => {
  return http.post<unknown, { following: boolean }>(`/user/creators/${creatorId}/follow`);
};

// 取消关注
export const unfollowCreator = (creatorId: string) => {
  return http.delete<unknown, { following: boolean }>(`/user/creators/${creatorId}/follow`);
};

// 查询关注状态
export const getCreatorFollowStatus = (creatorId: string) => {
  return http.get<unknown, { following: boolean; followerCount: number; isSelf: boolean }>(
    `/user/creators/${creatorId}/follow/status`,
  );
};

// 获取我关注的创作者列表
export const getMyFollows = (params: { page?: number; pageSize?: number } = {}) => {
  const { page = 1, pageSize = 20 } = params;
  return http.get<unknown, { list: MyFollowItem[]; total: number }>(
    `/user/follows?page=${page}&pageSize=${pageSize}`,
  );
};

// ========== 创作者申请 ==========

export interface CreatorApplicationStatus {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  name: string;
  description: string;
  reason: string;
  phone?: string;
  email?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

// 提交申请
export const submitCreatorApplication = (data: {
  name: string;
  description?: string;
  reason: string;
  phone?: string;
  email?: string;
}) => {
  return http.post<unknown, { id: string; status: string; createdAt: string }>(
    '/creator/application',
    data,
  );
};

// 查询我的申请状态
export const getMyCreatorApplication = () => {
  return http.get<unknown, CreatorApplicationStatus | null>('/creator/application/my');
};
