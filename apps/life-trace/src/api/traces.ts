import { apiRequest } from '@/api/request';
import type { ListPagination, NewTraceInput, Trace } from '@/types';

export type ListTracesOptions = {
  page?: number;
  pageSize?: number;
};

function buildListQuery(options: ListTracesOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listTraces(token: string, options: ListTracesOptions = {}) {
  return apiRequest<{ list: Trace[]; pagination?: ListPagination }>(
    `/life-trace/traces${buildListQuery(options)}`,
    token,
  );
}

export function createTrace(token: string, input: NewTraceInput) {
  return apiRequest<Trace>('/life-trace/traces', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTrace(token: string, id: string, input: NewTraceInput) {
  return apiRequest<Trace>(`/life-trace/traces/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTrace(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/traces/${id}`, token, {
    method: 'DELETE',
  });
}
