import { apiRequest } from './client';

export interface ServerNotification {
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

export interface NotificationListResponse {
  list: ServerNotification[];
  total: number;
  page: number;
  pageSize: number;
}

export function listMyNotifications(token: string, page = 1, pageSize = 20) {
  return apiRequest<NotificationListResponse>(
    `/user/notifications?page=${page}&pageSize=${pageSize}`,
    { token },
  );
}

export function getUnreadNotificationCount(token: string) {
  return apiRequest<{ unread: number }>('/user/notifications/unread-count', { token });
}

export function markNotificationRead(id: string, token: string) {
  return apiRequest<{ id: string; isRead: boolean }>(`/user/notifications/${id}/read`, {
    method: 'POST',
    token,
  });
}

export function markAllNotificationsRead(token: string) {
  return apiRequest<{ ok: boolean }>('/user/notifications/read-all', {
    method: 'POST',
    token,
  });
}
