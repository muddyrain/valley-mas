import axios from 'axios';
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
  keyword?: string; // 关键词搜索
  resourceType?: string; // 资源类型筛选
  dateFrom?: string; // 下载起始时间
  dateTo?: string; // 下载结束时间
}

export type DownloadRecordListResponse = PaginationResponse<DownloadRecord>;

// 获取下载记录列表
export function getDownloadRecords(params: DownloadRecordListParams) {
  return http.get<unknown, DownloadRecordListResponse>('/admin/records/downloads', { params });
}

// 导出下载记录 CSV
export async function exportDownloadRecords(params: DownloadRecordListParams) {
  const token = localStorage.getItem('admin_token');
  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/admin/records/downloads/export`,
    {
      params,
      responseType: 'blob',
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  return response.data as Blob;
}
