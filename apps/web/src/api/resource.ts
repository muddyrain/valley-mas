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
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  tags: string[];
  createdAt: string;
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

// 收藏资源
export const favoriteResource = (id: string) => {
  return http.post<void>(`/user/resources/${id}/favorite`);
};

// 取消收藏
export const unfavoriteResource = (id: string) => {
  return http.delete<void>(`/user/resources/${id}/favorite`);
};
