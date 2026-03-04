import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';

// 资源类型
export type ResourceType = 'avatar' | 'wallpaper';

// 用户信息（简化版）
export interface ResourceUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  role: string;
}

// 资源接口定义
export interface Resource {
  id: string; // Snowflake ID (后端 int64，序列化为字符串)
  title: string;
  type: ResourceType;
  url: string; // TOS 公开访问 URL
  size: number; // 文件大小（字节）
  downloadCount: number; // 下载次数
  createdAt: string;
  creatorId?: string; // 创建者 ID（可选）
  user?: ResourceUser; // 上传者信息（管理员）
}

// 资源列表查询参数
export interface ResourceListParams extends PaginationParams {
  keyword?: string; // 搜索关键词
  type?: ResourceType; // 按类型筛选
  creatorId?: string; // 按创作者筛选
}

// 资源列表响应
export type ResourceListResponse = PaginationResponse<Resource>;

// 上传资源响应
export interface UploadResourceResponse {
  id: string;
  url: string;
  title: string;
  type: ResourceType;
  size: number;
}

// 获取资源列表
export const reqGetResourceList = (params: ResourceListParams) => {
  return http.get<unknown, ResourceListResponse>('/admin/resources', { params });
};

// 上传资源
export const reqUploadResource = (formData: FormData) => {
  return http.post<unknown, UploadResourceResponse>('/admin/resources/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// 删除资源
export const reqDeleteResource = (id: string) => {
  return http.delete<unknown, null>(`/admin/resources/${id}`);
};

// 更新资源上传者
export const reqUpdateResourceCreator = (id: string, creatorId: string) => {
  return http.put<unknown, Resource>(`/admin/resources/${id}/creator`, { creatorId });
};
