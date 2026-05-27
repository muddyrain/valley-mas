import { apiRequest } from '@/api/request';
import type { NewTraceInput, Trace } from '@/types';

export function listTraces(token: string) {
  return apiRequest<{ list: Trace[] }>('/life-trace/traces', token);
}

export function createTrace(token: string, input: NewTraceInput) {
  return apiRequest<Trace>('/life-trace/traces', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteTrace(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/traces/${id}`, token, {
    method: 'DELETE',
  });
}
