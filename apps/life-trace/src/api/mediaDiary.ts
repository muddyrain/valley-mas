import { type ApiRequestInit, apiRequest } from '@/api/request';
import type {
  ListPagination,
  MediaDiaryAISuggestion,
  MediaDiaryEntry,
  MediaDiaryStatus,
  MediaDiarySummary,
  MediaDiaryType,
  NewMediaDiaryEntryInput,
} from '@/types';

export type ListMediaDiaryOptions = {
  page?: number;
  pageSize?: number;
  type?: MediaDiaryType | 'all';
  status?: MediaDiaryStatus | 'all';
  q?: string;
  tag?: string;
};

export type ListMediaDiaryResponse = {
  list: MediaDiaryEntry[];
  pagination?: ListPagination;
  summary: MediaDiarySummary;
};

export type MediaDiaryAISuggestInput = {
  mediaType: MediaDiaryType;
  title: string;
};

function buildListQuery(options: ListMediaDiaryOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
  }
  if (options.type && options.type !== 'all') {
    params.set('type', options.type);
  }
  if (options.status && options.status !== 'all') {
    params.set('status', options.status);
  }
  if (options.q?.trim()) {
    params.set('q', options.q.trim());
  }
  if (options.tag?.trim()) {
    params.set('tag', options.tag.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listMediaDiaryEntries(token: string, options: ListMediaDiaryOptions = {}) {
  return apiRequest<ListMediaDiaryResponse>(
    `/life-trace/media-diary${buildListQuery(options)}`,
    token,
  );
}

export function createMediaDiaryEntry(
  token: string,
  input: NewMediaDiaryEntryInput,
  init?: ApiRequestInit,
) {
  return apiRequest<MediaDiaryEntry>('/life-trace/media-diary', token, {
    method: 'POST',
    body: JSON.stringify(input),
    ...init,
  });
}

export function updateMediaDiaryEntry(token: string, id: string, input: NewMediaDiaryEntryInput) {
  return apiRequest<MediaDiaryEntry>(`/life-trace/media-diary/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteMediaDiaryEntry(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/media-diary/${id}`, token, {
    method: 'DELETE',
  });
}

export function suggestMediaDiaryEntry(token: string, input: MediaDiaryAISuggestInput) {
  return apiRequest<MediaDiaryAISuggestion>('/life-trace/media-diary/ai-suggest', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
