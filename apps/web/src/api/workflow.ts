import { useAuthStore } from '@/stores/useAuthStore';
import request from '@/utils/request';

export interface WorkflowGraph {
  schemaVersion: 2;
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
  data?: WorkflowRunEventData;
}

export interface WorkflowRunEventData {
  runId?: string;
  nodeId?: string;
  status?: 'running' | 'success' | 'error';
  message?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'error';
  inputs: string;
  result: string;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkflowNodeRun {
  id: string;
  workflowRunId: string;
  nodeId: string;
  nodeType: string;
  status: 'running' | 'success' | 'error';
  input: string;
  output: string;
  errorCode?: string;
  durationMs?: number;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkflowRunListData {
  list: WorkflowRun[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowRunDetail {
  run: WorkflowRun;
  nodes: WorkflowNodeRun[];
}

export interface AIWorkflowDraft {
  name: string;
  description: string;
  graph: {
    schemaVersion: 2;
    nodes: Array<{ id: string; type: string; config: Record<string, unknown> }>;
    edges: Array<{
      source: string;
      sourceHandle?: string;
      target: string;
      targetHandle?: string;
    }>;
  };
}

export interface WorkflowRunExplanation {
  cause: string;
  suggestions: string[];
  nodeId: string;
}

export function createAIWorkflowDraft(
  description: string,
  current?: AIWorkflowDraft,
  signal?: AbortSignal,
): Promise<{ draft: AIWorkflowDraft }> {
  return request.post('/workflows/ai-draft', { description, current }, { signal });
}

export function explainWorkflowRun(
  id: string,
  runId: string,
): Promise<{ explanation: WorkflowRunExplanation }> {
  return request.post(`/workflows/${id}/runs/${runId}/explain`);
}

export interface WorkflowVersion {
  id: string;
  number: number;
  createdAt: string;
}

export interface WorkflowPlatformData {
  app: {
    id: string;
    draftVersionId: string;
    publishedVersionId: string;
    status: 'draft' | 'published';
  };
  versions: WorkflowVersion[];
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

async function workflowRunErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: unknown };
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
  } catch {
    // Keep the caller's fallback when the server does not return JSON.
  }
  return fallback;
}

export async function runWorkflow(
  id: string,
  body: { inputs: Record<string, unknown>; files?: Record<string, File> },
  handlers: {
    onEvent: (event: WorkflowRunEvent) => void;
    onError: (msg: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const token = useAuthStore.getState().token;
  const base =
    (import.meta as { env: { VITE_API_BASE_URL: string } }).env.VITE_API_BASE_URL || '/api/v1';

  const formData = new FormData();
  formData.set('inputs', JSON.stringify(body.inputs));
  for (const [name, file] of Object.entries(body.files || {})) {
    formData.set(name, file, file.name);
  }

  try {
    const response = await fetch(`${base}/workflows/${id}/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      body: formData,
      signal,
    });

    if (!response.ok) {
      handlers.onError(await workflowRunErrorMessage(response, `请求失败: ${response.status}`));
      return;
    }

    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      handlers.onError(await workflowRunErrorMessage(response, '运行接口未返回事件流'));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      handlers.onError('无法读取响应流');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let receivedTerminalEvent = false;

    const handleLines = (text: string) => {
      const lines = text.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event: WorkflowRunEvent = JSON.parse(line.slice(6));
          handlers.onEvent(event);
          if (event.status === 'done') {
            receivedTerminalEvent = true;
          }
          if (event.status === 'error') {
            receivedTerminalEvent = true;
            handlers.onError(event.message || event.data?.error || '工作流执行失败');
          }
        } catch {
          // Ignore malformed event records and wait for a valid terminal event.
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      handleLines(buffer);
    }

    buffer += decoder.decode();
    if (buffer) handleLines(`${buffer}\n`);
    if (!receivedTerminalEvent) {
      handlers.onError('运行连接已关闭，未收到最终结果');
    }
  } catch (error) {
    if (signal?.aborted) {
      handlers.onError('运行已取消');
      return;
    }
    handlers.onError(error instanceof Error ? error.message : '运行请求失败');
  }
}

export function listWorkflowRuns(
  id: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<WorkflowRunListData> {
  return request.get(`/workflows/${id}/runs`, { params });
}

export function getWorkflowRun(id: string, runId: string): Promise<WorkflowRunDetail> {
  return request.get(`/workflows/${id}/runs/${runId}`);
}

export function getWorkflowPlatform(id: string): Promise<WorkflowPlatformData> {
  return request.get(`/workflows/${id}/platform`);
}

export function restoreWorkflowVersion(
  id: string,
  versionId: string,
): Promise<{ version: WorkflowVersion }> {
  return request.post(`/workflows/${id}/restore`, { versionId });
}

export function publishWorkflowVersion(id: string): Promise<void> {
  return request.post(`/workflows/${id}/publish`);
}
