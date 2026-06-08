import { apiRequest } from '@/api/request';
import type { AiActionRecord } from '@/lib/aiHistory';

export type ListAiActionsResponse = {
  list: AiActionRecord[];
};

export function listAiActions(token: string) {
  return apiRequest<ListAiActionsResponse>('/life-trace/ai/actions', token, {
    method: 'GET',
    suppressErrorToast: true,
  });
}

export function createAiAction(token: string, title: string, actionType = 'general') {
  return apiRequest<AiActionRecord>('/life-trace/ai/actions', token, {
    method: 'POST',
    body: JSON.stringify({ title, actionType }),
    suppressErrorToast: true,
  });
}
