import { useAuthStore } from '@/stores/useAuthStore';
import request from '@/utils/request';

export interface WorkflowSSEEvent {
  step: string;
  status: 'running' | 'success' | 'skipped' | 'error' | 'done';
  message?: string;
  data?: WorkflowStepData;
  postId?: string;
}

export type WorkflowStepData =
  | WorkflowParseData
  | WorkflowExcerptData
  | WorkflowCoverData
  | WorkflowTagsData
  | WorkflowCreateData;

export interface WorkflowParseData {
  title: string;
  excerpt?: string;
  cover?: string;
  tags?: string[];
  content: string;
}

export interface WorkflowExcerptData {
  excerpt: string;
  model?: string;
}

export interface WorkflowCoverData {
  coverUrl?: string;
  coverStorageKey?: string;
  coverSource: 'front_matter' | 'resource_pick' | 'ai_generate' | 'none';
  model?: string;
}

export interface WorkflowTagsData {
  tagNames: string[];
  tagIds: string[];
  model?: string;
}

export interface WorkflowCreateData {
  postId: string;
}

export interface StartBlogWorkflowParams {
  file: File;
  groupId?: string;
  visibility?: string;
  excludedCoverIds?: string[];
}

export async function startBlogWorkflow(
  params: StartBlogWorkflowParams,
  handlers: {
    onEvent: (event: WorkflowSSEEvent) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const token = useAuthStore.getState().token;

  const formData = new FormData();
  formData.append('file', params.file);
  if (params.groupId) formData.append('groupId', params.groupId);
  if (params.visibility) formData.append('visibility', params.visibility);
  if (params.excludedCoverIds?.length) {
    formData.append('excludedCoverIds', params.excludedCoverIds.join(','));
  }

  const res = await fetch(`${baseURL}/admin/blog/workflow/import`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    credentials: 'include',
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `workflow request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const evt of events) {
      const line = evt
        .split('\n')
        .map((item) => item.trim())
        .find((item) => item.startsWith('data:'));
      if (!line) continue;

      const raw = line.slice(5).trim();
      if (!raw) continue;

      try {
        const payload = JSON.parse(raw) as WorkflowSSEEvent;
        handlers.onEvent(payload);
        if (payload.status === 'done') return;
      } catch {
        // ignore invalid stream chunks
      }
    }
  }
}

export function publishWorkflowDraft(postId: string) {
  return request.post<unknown, { postId: string; status: string }>(
    `/admin/blog/workflow/${postId}/publish`,
  );
}
