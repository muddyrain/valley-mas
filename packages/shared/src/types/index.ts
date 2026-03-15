/**
 * 用户信息
 */
export interface User {
  id: string;
  nickname: string;
  avatar?: string;
  openid?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创作者信息
 */
export interface Creator {
  id: string;
  userId: string;
  name: string;
  description?: string;
  avatar?: string;
  code: string; // 口令
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 资源类型
 */
export type ResourceType = 'avatar' | 'wallpaper';

/**
 * 资源信息
 */
export interface Resource {
  id: string;
  creatorId: string;
  type: ResourceType;
  title: string;
  description?: string;
  url: string;
  width?: number;
  height?: number;
  size: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 下载记录
 */
export interface DownloadRecord {
  id: string;
  userId: string;
  resourceId: string;
  creatorId: string;
  downloadedAt: string;
}

/**
 * 上传记录
 */
export interface UploadRecord {
  id: string;
  creatorId: string;
  resourceId: string;
  uploadedAt: string;
}

/**
 * API 响应结构
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 口令验证请求
 */
export interface VerifyCodeRequest {
  code: string;
}

/**
 * 口令验证响应
 */
export interface VerifyCodeResponse {
  valid: boolean;
  creator?: Creator;
}
