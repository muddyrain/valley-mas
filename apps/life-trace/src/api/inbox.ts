import { apiRequest } from '@/api/request';
import type {
  InboxConvertedType,
  InboxItem,
  InboxItemStatus,
  InboxItemType,
  ListPagination,
  NewInboxItemInput,
} from '@/types';

export type ListInboxOptions = {
  page?: number;
  pageSize?: number;
  status?: InboxItemStatus | 'all';
  type?: InboxItemType | 'all';
  q?: string;
};

export type ConvertInboxItemInput = {
  convertedType: InboxConvertedType;
  convertedId: string;
};

function buildListQuery(options: ListInboxOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
  }
  if (options.status && options.status !== 'all') {
    params.set('status', options.status);
  }
  if (options.type && options.type !== 'all') {
    params.set('type', options.type);
  }
  if (options.q?.trim()) {
    params.set('q', options.q.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listInboxItems(token: string, options: ListInboxOptions = {}) {
  return apiRequest<{ list: InboxItem[]; pagination?: ListPagination }>(
    `/life-trace/inbox${buildListQuery(options)}`,
    token,
    { method: 'GET' },
  );
}

export function createInboxItem(token: string, input: NewInboxItemInput) {
  return apiRequest<InboxItem>('/life-trace/inbox', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateInboxItem(token: string, id: string, input: NewInboxItemInput) {
  return apiRequest<InboxItem>(`/life-trace/inbox/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateInboxItemStatus(token: string, id: string, status: InboxItemStatus) {
  return apiRequest<InboxItem>(`/life-trace/inbox/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function convertInboxItem(token: string, id: string, input: ConvertInboxItemInput) {
  return apiRequest<InboxItem>(`/life-trace/inbox/${id}/convert`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteInboxItem(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/inbox/${id}`, token, {
    method: 'DELETE',
  });
}
