import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';

// 下载记录接口定义
export interface DownloadRecord {
  id: string; // Snowflake ID
  userId: string;
  resourceId: string;
  creatorId: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  // 关联数据
  user?: {
    id: string;
    nickname: string;
    avatar: string;
  };
  resource?: {
    id: string;
    title: string;
    type: string;
    url: string;
  };
  creator?: {
    id: string;
    avatar: string;
    code: string;
    user?: {
      nickname: string;
    };
  };
}

export interface DownloadRecordListParams extends PaginationParams {
  resourceId?: string; // 按资源筛选
  creatorId?: string; // 按创作者筛选
  userId?: string; // 按用户筛选
}

export type DownloadRecordListResponse = PaginationResponse<DownloadRecord>;

// 获取下载记录列表
export function getDownloadRecords(params: DownloadRecordListParams) {
  return http.get<unknown, DownloadRecordListResponse>('/admin/records/downloads', { params });
}
