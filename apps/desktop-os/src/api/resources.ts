import { apiRequest } from './client';

export interface ServerResource {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  visibility?: string;
  downloadCount?: number;
  favoriteCount?: number;
  viewCount?: number;
  userId?: string;
  creatorName?: string;
  creatorAvatar?: string;
  creatorCode?: string;
  tags?: string[];
  createdAt?: string;
  size?: number;
  width?: number;
  height?: number;
  extension?: string;
  isFavorited?: boolean;
}

export interface ResourceListResponse {
  list: ServerResource[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface DownloadResourceResponse {
  downloadUrl: string;
  resource?: {
    id: string;
    title: string;
    type: string;
    size?: number;
  };
}

export type ServerResourceSort = 'newest' | 'oldest';

export function listResources(
  params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    tag?: string;
    sort?: ServerResourceSort;
    includeTags?: boolean;
  } = {},
  token?: string | null,
) {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 30),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.tag) query.set('tag', params.tag);
  if (params.sort) query.set('sort', params.sort);
  if (params.includeTags ?? true) query.set('includeTags', 'true');
  return apiRequest<ResourceListResponse>(`/public/resources?${query.toString()}`, { token });
}

export function getResourceDetail(id: string, token?: string | null) {
  return apiRequest<ServerResource>(`/public/resources/${id}`, { token });
}

export function favoriteResource(id: string, token: string) {
  return apiRequest<{ favorited: boolean }>(`/user/resources/${id}/favorite`, {
    method: 'POST',
    token,
  });
}

export function unfavoriteResource(id: string, token: string) {
  return apiRequest<{ favorited: boolean }>(`/user/resources/${id}/favorite`, {
    method: 'DELETE',
    token,
  });
}

export function downloadResource(id: string, token?: string | null) {
  return apiRequest<DownloadResourceResponse>(`/public/resource/${id}/download`, {
    method: 'POST',
    token,
  });
}
