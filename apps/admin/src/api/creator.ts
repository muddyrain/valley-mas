import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';

// 创作者接口定义
export interface Creator {
  id: string;
  userId: string;
  name: string;
  description: string;
  avatar: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // 统计数据（后端计算）
  resourceCount?: number;
  downloadCount?: number;

  // 用户信息（后端关联查询）
  username: string;
  userNickname: string;

  // 关联的空间
  space?: CreatorSpace;
}

// 创作者数据概览
export interface CreatorStats {
  totalResources: number;
  totalSpaces: number;
  totalDownloads: number;
  totalViews: number;
  todayDownloads: number;
  todayViews: number;
  last7DaysDownloads: number;
  last7DaysViews: number;
  downloadTrend: Array<{ date: string; count: number }>;
  viewTrend: Array<{ date: string; count: number }>;
  topResources: Array<{
    id: string;
    title: string;
    type: string;
    downloadCount: number;
    url: string;
    thumbnailUrl: string;
  }>;
  creatorInfo: {
    id: string;
    name: string;
    avatar: string;
    description: string;
  };
}

export interface CreatorListParams extends PaginationParams {
  keyword?: string; // 搜索关键词（名称或口令）
  isActive?: boolean; // 状态筛选
}

export type CreatorListResponse = PaginationResponse<Creator>;

// 获取创作者数据概览
export const reqGetCreatorStats = () => {
  return http.get<unknown, CreatorStats>('/admin/creator/stats');
};

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
// 注意：空间没有独立的 title 字段，空间名称使用创作者名称
export interface CreatorSpace {
  id: string;
  creatorId: string;
  // title 字段已移除，空间名称使用创作者名称，口令使用创作者 code
  description: string;
  banner: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // 关联数据
  resources?: Array<{ id: string; title: string; type: string; url: string }>;

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
export const reqGetSpaceDetail = (creatorId: string) => {
  return http.get<unknown, CreatorSpace>(`/admin/creators/${creatorId}/spaces/detail`);
};

// 创建/更新空间（一个创作者只有一个空间）
export const reqCreateSpace = (
  creatorId: string,
  data: {
    description?: string;
    banner?: string;
    isActive?: boolean;
  },
) => {
  return http.post<unknown, CreatorSpace>(`/admin/creators/${creatorId}/spaces`, data);
};

// 更新空间
export const reqUpdateSpace = (creatorId: string, data: Partial<CreatorSpace>) => {
  return http.put<unknown, CreatorSpace>(`/admin/creators/${creatorId}/spaces`, data);
};

// 删除空间
export const reqDeleteSpace = (creatorId: string) => {
  return http.delete<unknown, void>(`/admin/creators/${creatorId}/spaces`);
};

// 为空间添加资源
export const reqAddResourcesToSpace = (creatorId: string, resourceIds: string[]) => {
  return http.post<unknown, void>(`/admin/creators/${creatorId}/spaces/resources`, {
    resourceIds,
  });
};

// 从空间移除资源
export const reqRemoveResourcesFromSpace = (creatorId: string, resourceIds: string[]) => {
  return http.delete<unknown, void>(`/admin/creators/${creatorId}/spaces/resources`, {
    data: { resourceIds },
  });
};
