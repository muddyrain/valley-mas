import http from '@/utils/request';

export interface UserNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  extraData?: string;
  createdAt: string;
}

interface ListResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const getMyNotifications = (page = 1, pageSize = 10) => {
  return http.get<unknown, ListResponse<UserNotification>>(
    `/user/notifications?page=${page}&pageSize=${pageSize}`,
  );
};

export const getUnreadNotificationCount = () => {
  return http.get<unknown, { unread: number }>('/user/notifications/unread-count');
};

export const markNotificationRead = (id: string) => {
  return http.post<unknown, { id: string; isRead: boolean }>(`/user/notifications/${id}/read`);
};

export const markAllNotificationsRead = () => {
  return http.post<unknown, { ok: boolean }>('/user/notifications/read-all');
};
