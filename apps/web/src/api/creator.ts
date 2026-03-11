import http from '@/utils/request';

// 创作者类型
export interface Creator {
  id: string;
  name: string;
  avatar: string;
  description: string;
  resourceCount: number;
  downloadCount: number;
  followerCount: number;
  createdAt: string;
}

// 资源类型
export interface Resource {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  type: string;
  downloadCount: number;
  creatorId: string;
  creatorName: string;
  isTop: boolean;
}

// 专辑类型
export interface Album {
  id: string;
  name: string;
  coverUrl: string;
  resourceCount: number;
  creatorId: string;
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

// 获取创作者详情
export const getCreatorByCode = (code: string) => {
  return http.get<unknown, Creator>(`/public/creator/${code}`);
};

// 获取创作者作品
export const getCreatorWorks = (
  creatorId: string,
  params: {
    page?: number;
    pageSize?: number;
    category?: string;
    keyword?: string;
  } = {},
) => {
  const { page = 1, pageSize = 20, category, keyword } = params;
  let url = `/public/creator/${creatorId}/works?page=${page}&pageSize=${pageSize}`;
  if (category) url += `&category=${category}`;
  if (keyword) url += `&keyword=${keyword}`;

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

// 关注创作者
export const followCreator = (creatorId: string) => {
  return http.post<void>(`/user/creators/${creatorId}/follow`);
};

// 取消关注
export const unfollowCreator = (creatorId: string) => {
  return http.delete<void>(`/user/creators/${creatorId}/follow`);
};
