import request from '@/utils/request';

export interface GuestbookMessage {
  id: string;
  userId?: string;
  nickname: string;
  avatar?: string;
  content: string;
  isPinned: boolean;
  canDelete?: boolean;
  canPin?: boolean;
  createdAt: string;
}

export interface GuestbookListData {
  list: GuestbookMessage[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getGuestbookMessages(params: { page?: number; pageSize?: number } = {}) {
  return request.get<unknown, GuestbookListData>('/public/guestbook/messages', { params });
}

export function createGuestbookMessage(data: { content: string }) {
  return request.post<unknown, { message: GuestbookMessage }>('/public/guestbook/messages', data);
}

export function deleteGuestbookMessage(id: string) {
  return request.delete<unknown, { id: string; deleted: boolean }>(`/guestbook/messages/${id}`);
}

export function updateGuestbookMessagePin(id: string, isPinned: boolean) {
  return request.patch<unknown, { message: GuestbookMessage }>(`/guestbook/messages/${id}/pin`, {
    isPinned,
  });
}
