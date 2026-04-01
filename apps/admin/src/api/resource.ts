import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';

export type ResourceType = 'avatar' | 'wallpaper';
export type ResourceVisibility = 'private' | 'shared' | 'public';

export interface ResourceUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  role: string;
}

export interface Resource {
  id: string;
  title: string;
  type: ResourceType;
  visibility: ResourceVisibility;
  url: string;
  storageKey?: string;
  size: number;
  downloadCount: number;
  createdAt: string;
  uploaderId?: string;
  user?: ResourceUser;
}

export interface ResourceListParams extends PaginationParams {
  keyword?: string;
  type?: ResourceType;
  uploaderId?: string;
}

export type ResourceListResponse = PaginationResponse<Resource>;

export interface UploadResourceResponse {
  id: string;
  url: string;
  title: string;
  type: ResourceType;
  visibility: ResourceVisibility;
  size: number;
}

export const reqGetResourceList = (params: ResourceListParams) => {
  return http.get<unknown, ResourceListResponse>('/admin/resources', { params });
};

export const reqUploadResource = (formData: FormData) => {
  return http.post<unknown, UploadResourceResponse>('/admin/resources/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const reqDeleteResource = (id: string) => {
  return http.delete<unknown, null>(`/admin/resources/${id}`);
};

export const reqUpdateResource = (
  id: string,
  data: Partial<{
    title: string;
    description: string;
    type: ResourceType;
    visibility: ResourceVisibility;
  }>,
) => {
  return http.patch<unknown, Resource>(`/admin/resources/${id}`, data);
};

export const reqUpdateResourceCreator = (id: string, uploaderId: string) => {
  return http.put<unknown, Resource>(`/admin/resources/${id}/creator`, { uploaderId });
};
