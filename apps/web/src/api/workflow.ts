import { useAuthStore } from '@/stores/useAuthStore';
import request from '@/utils/request';

export interface WorkflowGraph {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
    targetHandle?: string;
  }>;
}

export interface WorkflowItem {
  id: string;
  userId: string;
  name: string;
  description: string;
  graph: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowListData {
  list: WorkflowItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowRunEvent {
  step: string;
  status: 'running' | 'success' | 'error' | 'done';
  message?: string;
  data?: unknown;
}

export async function createWorkflow(data: {
  name: string;
  description?: string;
  graph?: string;
  status?: string;
}): Promise<WorkflowItem> {
  return request.post('/workflows', data);
}

export async function listWorkflows(params?: {
  page?: number;
  pageSize?: number;
}): Promise<WorkflowListData> {
  return request.get('/workflows', { params });
}

export async function getWorkflow(id: string): Promise<WorkflowItem> {
  return request.get(`/workflows/${id}`);
}

export async function updateWorkflow(
  id: string,
  data: Partial<{ name: string; description: string; graph: string; status: string }>,
): Promise<void> {
  return request.put(`/workflows/${id}`, data);
}

export async function deleteWorkflow(id: string): Promise<void> {
  return request.delete(`/workflows/${id}`);
}

export async function runWorkflow(
  id: string,
  body: { inputs?: Record<string, Record<string, unknown>> },
  handlers: {
    onEvent: (event: WorkflowRunEvent) => void;
    onError: (msg: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const token = useAuthStore.getState().token;
  const base =
    (import.meta as { env: { VITE_API_BASE_URL: string } }).env.VITE_API_BASE_URL || '/api/v1';

  const response = await fetch(`${base}/workflows/${id}/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    handlers.onError(`请求失败: ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError('无法读取响应流');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: WorkflowRunEvent = JSON.parse(line.slice(6));
          handlers.onEvent(event);
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}
