import http, { type RequestConfig } from '@/utils/request';

export type ResourceVisibility = 'private' | 'shared' | 'public';

// 资源类型
export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl?: string; // 缩略图 URL（800px WebP，大图时由 TOS 参数生成，小图同原图）
  type: 'wallpaper' | 'avatar' | 'emoji' | 'background' | 'dynamic';
  visibility?: ResourceVisibility;
  downloadCount: number;
  viewCount: number;
  likeCount: number;
  favoriteCount?: number;
  userId: string;
  userName: string;
  userAvatar: string;
  tags?: string[];
  createdAt: string;
  size?: number;
  width?: number; // 图片宽度（px）
  height?: number; // 图片高度（px）
  extension?: string; // 文件格式，如 jpg / png / gif
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

// 获取全部资源（资源广场，支持分页+类型+关键词+标签筛选）
export const getAllResources = (
  params: {
    page?: number;
    pageSize?: number;
    type?: string;
    keyword?: string;
    tag?: string;
    sort?: 'newest' | 'oldest';
    includeTags?: boolean;
  } = {},
) => {
  const { page = 1, pageSize = 20, type, keyword, tag, sort, includeTags = false } = params;
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (type) query.set('type', type);
  if (keyword) query.set('keyword', keyword);
  if (tag) query.set('tag', tag);
  if (sort) query.set('sort', sort);
  if (includeTags) query.set('includeTags', 'true');
  return http.get<unknown, ListResponse<Resource>>(`/public/resources?${query.toString()}`);
};

// 获取用户的资源列表
export const getUserResources = (
  userId: string,
  params: { page?: number; pageSize?: number; type?: string; keyword?: string } = {},
) => {
  const { page = 1, pageSize = 20, type, keyword } = params;
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (type) query.set('type', type);
  if (keyword) query.set('keyword', keyword);
  return http.get<unknown, ListResponse<Resource>>(
    `/public/users/${userId}/resources?${query.toString()}`,
  );
};

// 获取资源详情
export const getResourceDetail = (id: string, config?: RequestConfig) => {
  return http.get<unknown, Resource>(`/public/resources/${id}`, config);
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
  return http.post<unknown, { downloadUrl: string }>(`/public/resource/${id}/download`);
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
      page: number;
      pageSize: number;
    }
  >(`/user/favorites?page=${page}&pageSize=${pageSize}`);
};

// ========== 资源管理接口 ==========

export interface MyResource {
  id: string;
  title: string;
  description?: string;
  type: string;
  visibility?: ResourceVisibility;
  url: string;
  thumbnailUrl: string;
  size: number;
  width: number;
  height: number;
  extension: string;
  downloadCount: number;
  createdAt: string;
  storageKey: string;
  tags?: string[];
}

interface MyResourcesResponse {
  list: MyResource[];
  total: number;
}

export const RESOURCE_UPLOAD_TIMEOUT = 5 * 60 * 1000;

// 获取我上传的资源列表
export const getMyResources = (
  params: {
    page?: number;
    pageSize?: number;
    type?: string;
    albumId?: string;
    keyword?: string;
  } = {},
  config?: RequestConfig,
) => {
  const { page = 1, pageSize = 20, type, albumId, keyword } = params;
  let url = `/content/resources?page=${page}&pageSize=${pageSize}`;
  if (type) url += `&type=${type}`;
  if (albumId) url += `&albumId=${albumId}`;
  if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
  return http.get<unknown, MyResourcesResponse>(url, config);
};

// 上传资源
export const uploadResource = (formData: FormData) => {
  return http.post<unknown, { resource: MyResource }>('/content/resources/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: RESOURCE_UPLOAD_TIMEOUT,
  });
};

export const getUploadResourceStatus = (uploadKey: string, config?: RequestConfig) => {
  const query = new URLSearchParams({ uploadKey });
  return http.get<unknown, { found: boolean; resource?: MyResource }>(
    `/content/resources/upload-status?${query.toString()}`,
    config,
  );
};

// 删除资源
export const deleteResource = (id: string) => {
  return http.delete<void>(`/content/resources/${id}`);
};

// 修改资源元数据（标题、描述、类型、标签）
export const updateResource = (
  id: string,
  data: {
    title?: string;
    description?: string;
    type?: string;
    visibility?: ResourceVisibility;
    tags?: string[];
  },
) => {
  return http.patch<
    unknown,
    {
      id: string;
      title: string;
      description: string;
      type: string;
      visibility?: ResourceVisibility;
      tags?: string[];
    }
  >(`/content/resources/${id}`, data);
};

// AI 根据图片内容建议多个资源标题
export const suggestResourceTitle = (
  imageBase64: string,
  type: 'wallpaper' | 'avatar',
  modelId: string,
) => {
  return http.post<unknown, { titles: string[] }>('/content/ai/suggest-title', {
    imageBase64,
    type,
    modelId,
  });
};

// ========== 资源标签接口 ==========
// 标签不再有独立的实体表，仅在 AI 生成候选时使用。

// AI 根据图片 base64 + 类型 + 标题 + 描述 在线生成候选标签
export const aiSuggestResourceTags = (data: {
  imageBase64?: string;
  type: string;
  title?: string;
  description?: string;
  modelId: string;
}) => {
  return http.post<unknown, { tags: string[]; model: string }>(
    '/content/ai/resource-tags/suggest',
    data,
  );
};

// 批量删除资源
export const batchDeleteResources = (ids: string[]) => {
  return http.delete<unknown, { deleted: number }>('/content/resources/batch', { data: { ids } });
};

// 批量设置资源访问范围
export const batchUpdateVisibility = (ids: string[], visibility: ResourceVisibility) => {
  return http.post<unknown, { updated: number }>('/content/resources/batch-visibility', {
    ids,
    visibility,
  });
};
