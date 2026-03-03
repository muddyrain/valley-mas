import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';

// 创作者接口定义
export interface Creator {
  id: string;
  userId: string;
  name: string;
  description: string;
  avatar: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // 统计数据（后端计算）
  spaceCount?: number;
  resourceCount?: number;
  downloadCount?: number;
}

export interface CreatorListParams extends PaginationParams {
  keyword?: string; // 搜索关键词（名称或口令）
  isActive?: boolean; // 状态筛选
}

export type CreatorListResponse = PaginationResponse<Creator>;

// 获取创作者列表
export const reqGetCreatorList = (params: CreatorListParams) => {
  return http.get<unknown, CreatorListResponse>('/admin/creators', { params });
};

// 获取创作者详情
export const reqGetCreatorDetail = (id: string) => {
  return http.get<unknown, Creator>(`/admin/creators/${id}`);
};

// 创建创作者
export const reqCreateCreator = (data: {
  userId: string;
  name: string;
  description?: string;
  avatar?: string;
  isActive?: boolean;
}) => {
  return http.post<unknown, Creator>('/admin/creators', data);
};

// 更新创作者
export const reqUpdateCreator = (id: string, data: Partial<Creator>) => {
  return http.put<unknown, Creator>(`/admin/creators/${id}`, data);
};

// 删除创作者
export const reqDeleteCreator = (id: string) => {
  return http.delete<unknown, void>(`/admin/creators/${id}`);
};

// 切换创作者状态
export const reqToggleCreatorStatus = (id: string) => {
  return http.post<unknown, Creator>(`/admin/creators/${id}/toggle-status`);
};

// ==================== 空间管理 ====================

// 空间接口定义
export interface CreatorSpace {
  id: string;
  creatorId: string;
  title: string;
  code: string;
  description: string;
  banner: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // 统计数据
  resourceCount?: number;
  downloadCount?: number;
}

export interface SpaceListParams extends PaginationParams {
  keyword?: string;
  isActive?: boolean;
}

export type SpaceListResponse = PaginationResponse<CreatorSpace>;

// 获取创作者的空间列表
export const reqGetSpaceList = (creatorId: string, params?: SpaceListParams) => {
  return http.get<unknown, SpaceListResponse>(`/admin/creators/${creatorId}/spaces`, { params });
};

// 获取空间详情
export const reqGetSpaceDetail = (creatorId: string, spaceId: string) => {
  return http.get<unknown, CreatorSpace>(`/admin/creators/${creatorId}/spaces/${spaceId}`);
};

// 创建空间
export const reqCreateSpace = (
  creatorId: string,
  data: {
    title: string;
    description?: string;
    banner?: string;
    code?: string;
    isActive?: boolean;
  },
) => {
  return http.post<unknown, CreatorSpace>(`/admin/creators/${creatorId}/spaces`, data);
};

// 更新空间
export const reqUpdateSpace = (creatorId: string, spaceId: string, data: Partial<CreatorSpace>) => {
  return http.put<unknown, CreatorSpace>(`/admin/creators/${creatorId}/spaces/${spaceId}`, data);
};

// 删除空间
export const reqDeleteSpace = (creatorId: string, spaceId: string) => {
  return http.delete<unknown, void>(`/admin/creators/${creatorId}/spaces/${spaceId}`);
};

// 为空间添加资源
export const reqAddResourcesToSpace = (
  creatorId: string,
  spaceId: string,
  resourceIds: string[],
) => {
  return http.post<unknown, void>(`/admin/creators/${creatorId}/spaces/${spaceId}/resources`, {
    resourceIds,
  });
};

// 从空间移除资源
export const reqRemoveResourcesFromSpace = (
  creatorId: string,
  spaceId: string,
  resourceIds: string[],
) => {
  return http.delete<unknown, void>(`/admin/creators/${creatorId}/spaces/${spaceId}/resources`, {
    data: { resourceIds },
  });
};
