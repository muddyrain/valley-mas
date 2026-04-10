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
  creatorName: string;
  creatorAvatar: string;
  creatorCode?: string; // 创作者页跳转 code
  tags: Array<{ id: string; name: string }>;
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
    tagId?: string;
  } = {},
) => {
  const { page = 1, pageSize = 20, type, keyword, tagId } = params;
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (type) query.set('type', type);
  if (keyword) query.set('keyword', keyword);
  if (tagId) query.set('tagId', tagId);
  return http.get<unknown, ListResponse<Resource>>(`/public/resources?${query.toString()}`);
};

// 获取创作者的资源列表
export const getCreatorResources = (
  creatorId: string,
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
    `/public/creators/${creatorId}/resources?${query.toString()}`,
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

// ========== 创作者资源管理接口 ==========

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
  tags?: ResourceTag[];
}

interface MyResourcesResponse {
  list: MyResource[];
  total: number;
}

// 获取我上传的资源列表（需要创作者/管理员权限）
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
  let url = `/creator/resources?page=${page}&pageSize=${pageSize}`;
  if (type) url += `&type=${type}`;
  if (albumId) url += `&albumId=${albumId}`;
  if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
  return http.get<unknown, MyResourcesResponse>(url, config);
};

// 上传资源（需要创作者/管理员权限）
export const uploadResource = (formData: FormData) => {
  return http.post<unknown, { resource: MyResource }>('/creator/resources/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// 删除资源（需要创作者/管理员权限）
export const deleteResource = (id: string) => {
  return http.delete<void>(`/creator/resources/${id}`);
};

// 修改资源元数据（标题、描述、类型）
export const updateResource = (
  id: string,
  data: { title?: string; description?: string; type?: string; visibility?: ResourceVisibility },
) => {
  return http.patch<
    unknown,
    {
      id: string;
      title: string;
      description: string;
      type: string;
      visibility?: ResourceVisibility;
    }
  >(`/creator/resources/${id}`, data);
};

// AI 根据图片内容建议多个资源标题
export const suggestResourceTitle = (imageBase64: string, type: 'wallpaper' | 'avatar') => {
  return http.post<unknown, { titles: string[] }>('/creator/ai/suggest-title', {
    imageBase64,
    type,
  });
};

// ========== 资源标签接口 ==========

export interface ResourceTag {
  id: string;
  name: string;
  description: string;
  resourceCount: number;
  createdAt: string;
}

interface TagListResponse {
  list: ResourceTag[];
  total: number;
  page: number;
  pageSize: number;
}

// 获取全部标签（公开 / 管理端通用）
export const getResourceTags = (
  params: { keyword?: string; page?: number; pageSize?: number } = {},
) => {
  const { keyword, page = 1, pageSize = 100 } = params;
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (keyword) q.set('keyword', keyword);
  return http.get<unknown, TagListResponse>(`/admin/resource-tags?${q.toString()}`);
};

// 获取公开资源标签（无需鉴权）
export const getPublicResourceTags = (
  params: { keyword?: string; page?: number; pageSize?: number } = {},
) => {
  const { keyword, page = 1, pageSize = 50 } = params;
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (keyword) q.set('keyword', keyword);
  return http.get<unknown, TagListResponse>(`/public/resource-tags?${q.toString()}`);
};

// 创建标签
export const createResourceTag = (data: { name: string; description?: string }) => {
  return http.post<unknown, ResourceTag>('/creator/resource-tags', data);
};

// 更新标签
export const updateResourceTag = (id: string, data: { name?: string; description?: string }) => {
  return http.patch<unknown, ResourceTag>(`/admin/resource-tags/${id}`, data);
};

// 删除标签
export const deleteResourceTag = (id: string) => {
  return http.delete<void>(`/admin/resource-tags/${id}`);
};

// 获取某资源当前绑定的标签
export const getResourceTagsById = (resourceId: string) => {
  return http.get<unknown, ResourceTag[]>(`/creator/resources/${resourceId}/tags`);
};

// 设置某资源的标签（全量覆盖）
export const setResourceTags = (resourceId: string, tagIds: string[]) => {
  return http.put<unknown, ResourceTag[]>(`/creator/resources/${resourceId}/tags`, { tagIds });
};

// AI 自动匹配标签（后端直接使用资源 URL，无需前端传图片）
export const aiMatchResourceTags = (resourceId: string) => {
  return http.post<unknown, { tags: ResourceTag[]; model: string }>(
    `/creator/resources/${resourceId}/tags/ai-match`,
    {},
  );
};

// AI 根据图片 base64 + 类型 + 标题建议标签（上传前使用，无需 resourceId）
export const aiSuggestResourceTags = (data: {
  imageBase64?: string;
  type: string;
  title?: string;
  description?: string;
}) => {
  return http.post<unknown, { tags: ResourceTag[]; model: string }>(
    '/creator/ai/suggest-tags',
    data,
  );
};

// AI 根据标签名称生成描述
export const suggestResourceTagDescription = (name: string) => {
  return http.post<unknown, { description: string; model: string }>(
    '/creator/ai/suggest-tag-description',
    { name },
  );
};

// 批量删除资源
export const batchDeleteResources = (ids: string[]) => {
  return http.delete<unknown, { deleted: number }>('/creator/resources/batch', { data: { ids } });
};

// 批量设置资源访问范围
export const batchUpdateVisibility = (ids: string[], visibility: ResourceVisibility) => {
  return http.post<unknown, { updated: number }>('/creator/resources/batch-visibility', {
    ids,
    visibility,
  });
};
