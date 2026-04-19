import http from '@/utils/request';

export interface WebSystemUpdateItem {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  updatedAt: string;
}

interface ListResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const getWebSystemUpdates = (page = 1, pageSize = 20) => {
  return http.get<unknown, ListResponse<WebSystemUpdateItem>>(
    `/public/system-updates?page=${page}&pageSize=${pageSize}`,
  );
};
