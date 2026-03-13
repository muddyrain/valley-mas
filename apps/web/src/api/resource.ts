import http from '@/utils/request';

// 资源类型
export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  type: 'wallpaper' | 'avatar' | 'emoji' | 'background' | 'dynamic';
  downloadCount: number;
  viewCount: number;
  likeCount: number;
  userId: string;
  creatorName: string;
  creatorAvatar: string;
  tags: string[];
  createdAt: string;
  /** 当前用户是否已收藏（仅登录用户时服务端返回 true/false，未登录为 false） */
  isFavorited?: boolean;
}

// 列表响应类型
interface ListResponse<T> {
  list: T[];
  total: number;
}

// 获取热门资源
export const getHotResources = (page = 1, pageSize = 20) => {
  return http.get<unknown, ListResponse<Resource>>(
    `/public/hot-resources?page=${page}&pageSize=${pageSize}`,
  );
};

// 获取创作者的资源列表
export const getCreatorResources = (
  creatorId: string,
  params: { page?: number; pageSize?: number } = {},
) => {
  const { page = 1, pageSize = 20 } = params;
  return http.get<unknown, ListResponse<Resource>>(
    `/public/creators/${creatorId}/resources?page=${page}&pageSize=${pageSize}`,
  );
};

// 获取资源详情
export const getResourceDetail = (id: string) => {
  return http.get<unknown, Resource>(`/public/resources/${id}`);
};

// 搜索资源
export const searchResources = (
  keyword: string,
  params: {
    page?: number;
    pageSize?: number;
    type?: string;
  } = {},
) => {
  const { page = 1, pageSize = 20, type } = params;
  let url = `/public/search?keyword=${encodeURIComponent(
    keyword,
  )}&page=${page}&pageSize=${pageSize}`;
  if (type) url += `&type=${type}`;

  return http.get<unknown, ListResponse<Resource>>(url);
};

// 下载资源
export const downloadResource = (id: string) => {
  return http.post<unknown, { downloadUrl: string }>(`/user/resources/${id}/download`);
};

// 收藏资源（喜欢）
export const favoriteResource = (id: string) => {
  return http.post<unknown, { favorited: boolean }>(`/user/resources/${id}/favorite`);
};

// 取消收藏
export const unfavoriteResource = (id: string) => {
  return http.delete<unknown, { favorited: boolean }>(`/user/resources/${id}/favorite`);
};

// 查询资源收藏状态
export const getResourceFavoriteStatus = (id: string) => {
  return http.get<unknown, { favorited: boolean }>(`/user/resources/${id}/favorite/status`);
};

// 批量查询资源收藏状态，返回 { resourceId: boolean } 的 map
export const batchGetFavoriteStatus = (ids: string[]) => {
  return http.post<unknown, { favorited: Record<string, boolean> }>(
    '/user/resources/favorite/batch-status',
    { ids },
  );
};

// 获取我的收藏列表
export const getMyFavorites = (params: { page?: number; pageSize?: number } = {}) => {
  const { page = 1, pageSize = 20 } = params;
  return http.get<
    unknown,
    {
      list: Array<{
        id: string;
        userId: string;
        resourceId: string;
        createdAt: string;
        resource?: Resource;
      }>;
      total: number;
    }
  >(`/user/favorites?page=${page}&pageSize=${pageSize}`);
};

// ========== 创作者资源管理接口 ==========

export interface MyResource {
  id: string;
  title: string;
  type: string;
  url: string;
  thumbnailUrl: string;
  size: number;
  downloadCount: number;
  createdAt: string;
  storageKey: string;
}

interface MyResourcesResponse {
  list: MyResource[];
  total: number;
}

// 获取我上传的资源列表（需要创作者/管理员权限）
export const getMyResources = (
  params: { page?: number; pageSize?: number; type?: string } = {},
) => {
  const { page = 1, pageSize = 20, type } = params;
  let url = `/admin/resources?page=${page}&pageSize=${pageSize}`;
  if (type) url += `&type=${type}`;
  return http.get<unknown, MyResourcesResponse>(url);
};

// 上传资源（需要创作者/管理员权限）
export const uploadResource = (formData: FormData) => {
  return http.post<unknown, { resource: MyResource }>('/admin/resources/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// 删除资源（需要创作者/管理员权限）
export const deleteResource = (id: string) => {
  return http.delete<void>(`/admin/resources/${id}`);
};
