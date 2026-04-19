import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';

export type SystemUpdateStatus = 'draft' | 'published';

export interface SystemUpdateItem {
  id: string;
  platform: 'web';
  title: string;
  content: string;
  status: SystemUpdateStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemUpdateListParams extends PaginationParams {
  keyword?: string;
  status?: SystemUpdateStatus;
}

export type SystemUpdateListResponse = PaginationResponse<SystemUpdateItem>;

export interface SaveSystemUpdatePayload {
  title: string;
  content: string;
  status: SystemUpdateStatus;
  publishedAt?: string;
}

export const reqGetSystemUpdateList = (params: SystemUpdateListParams) => {
  return http.get<unknown, SystemUpdateListResponse>('/admin/system-updates', { params });
};

export const reqCreateSystemUpdate = (payload: SaveSystemUpdatePayload) => {
  return http.post<unknown, SystemUpdateItem>('/admin/system-updates', payload);
};

export const reqUpdateSystemUpdate = (id: string, payload: SaveSystemUpdatePayload) => {
  return http.put<unknown, SystemUpdateItem>(`/admin/system-updates/${id}`, payload);
};

export const reqDeleteSystemUpdate = (id: string) => {
  return http.delete<unknown, { deleted: boolean }>(`/admin/system-updates/${id}`);
};
