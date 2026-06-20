import { apiRequest } from './client';

export const DESKTOP_NOTE_TAG = 'desktop-os-note';

export interface LifeTraceInboxItem {
  id: string;
  title: string;
  content?: string;
  itemType: 'text' | 'link' | 'image';
  linkUrl?: string;
  imageUrl?: string;
  tags: string[];
  status: 'inbox' | 'converted' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

interface InboxListResponse {
  list: LifeTraceInboxItem[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

export interface NoteInput {
  title: string;
  content: string;
}

function notePayload(input: NoteInput) {
  return {
    title: input.title.trim() || '无标题便签',
    content: input.content.trim(),
    itemType: 'text',
    tags: [DESKTOP_NOTE_TAG, '便签'],
  };
}

export function listNoteInboxItems(token: string) {
  return apiRequest<InboxListResponse>(
    '/life-trace/inbox?page=1&pageSize=50&status=inbox&type=text',
    {
      token,
    },
  );
}

export function createNoteInboxItem(token: string, input: NoteInput) {
  return apiRequest<LifeTraceInboxItem>('/life-trace/inbox', {
    method: 'POST',
    token,
    body: notePayload(input),
  });
}

export function updateNoteInboxItem(token: string, id: string, input: NoteInput) {
  return apiRequest<LifeTraceInboxItem>(`/life-trace/inbox/${id}`, {
    method: 'PATCH',
    token,
    body: notePayload(input),
  });
}

export function deleteNoteInboxItem(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/inbox/${id}`, {
    method: 'DELETE',
    token,
  });
}
