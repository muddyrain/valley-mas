import { useAuthStore } from '@/stores/useAuthStore';
import request from '@/utils/request';

export function getAPIErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data
      ?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export type AIAppType = 'agent' | 'workflow';

export interface AIApp {
  id: string;
  type: AIAppType;
  workflowId?: string;
  name: string;
  description: string;
  status: 'draft' | 'published';
  draftVersionId: string;
  publishedVersionId: string;
  updatedAt: string;
}

export interface AIAppVersion {
  id: string;
  appId: string;
  number: number;
  config: string;
  createdAt: string;
}

export interface AIAppDetail {
  app: AIApp;
  versions: AIAppVersion[];
}

export interface AIAppRun {
  id: string;
  versionId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  model: string;
  input: string;
  output: string;
  errorCode: string;
  durationMs: number;
  createdAt: string;
}

export interface AIKnowledgeReference {
  documentName: string;
  chunkId: string;
  excerpt: string;
}

export interface AIKnowledgeBase {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIKnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  status: 'pending' | 'pending_embedding' | 'indexing' | 'ready' | 'failed';
  errorCode: string;
  indexProgress: number;
  chunkCount: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export function listAIApps(): Promise<{ list: AIApp[] }> {
  return request.get('/ai/apps');
}

export function createAIApp(data: {
  type: AIAppType;
  name: string;
  description?: string;
  config: object;
}): Promise<{ app: AIApp; version: AIAppVersion }> {
  return request.post('/ai/apps', data);
}

export function publishAIApp(appId: string, versionId?: string): Promise<void> {
  return request.post(`/ai/apps/${appId}/publish`, { versionId });
}

export function getAIApp(appId: string): Promise<AIAppDetail> {
  return request.get(`/ai/apps/${appId}`);
}

export function saveAIAppVersion(
  appId: string,
  data: { name: string; description: string; config: object },
): Promise<{ version: AIAppVersion }> {
  return request.post(`/ai/apps/${appId}/versions`, data);
}

export function restoreAIAppVersion(
  appId: string,
  versionId: string,
): Promise<{ version: AIAppVersion; restoredFromVersionId: string }> {
  return request.post(`/ai/apps/${appId}/restore`, { versionId });
}

export function debugAIApp(
  appId: string,
  message: string,
): Promise<{ run: AIAppRun; reply: string; model: string }> {
  return request.post(`/ai/apps/${appId}/debug`, { message });
}

export async function streamDebugAIApp(
  appId: string,
  message: string,
  handlers: {
    onDelta: (chunk: string) => void;
    onDone: (run: AIAppRun, reply: string, references: AIKnowledgeReference[]) => void;
    onError: (message: string, run?: AIAppRun) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const response = await fetch(`${base}/ai/apps/${appId}/debug`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${useAuthStore.getState().token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, stream: true }),
    signal,
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const body = await response.text();
    try {
      const payload = JSON.parse(body) as { message?: string };
      handlers.onError(payload.message || '调试运行失败');
    } catch {
      handlers.onError(body || '调试运行失败');
    }
    return;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError('无法读取调试响应');
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const records = buffer.split('\n\n');
    buffer = records.pop() || '';
    for (const record of records) {
      const line = record.split('\n').find((item) => item.startsWith('data: '));
      if (!line) continue;
      try {
        const event = JSON.parse(line.slice(6)) as {
          type?: string;
          chunk?: string;
          message?: string;
          run?: AIAppRun;
          reply?: string;
          references?: AIKnowledgeReference[];
        };
        if (event.type === 'delta' && event.chunk) handlers.onDelta(event.chunk);
        if (event.type === 'error') handlers.onError(event.message || '调试运行失败', event.run);
        if (event.type === 'done' && event.run) {
          handlers.onDone(event.run, event.reply || '', event.references || []);
        }
      } catch {
        /* Ignore malformed partial events. */
      }
    }
  }
}

export function listAIAppRuns(appId: string): Promise<{ list: AIAppRun[] }> {
  return request.get(`/ai/apps/${appId}/runs`);
}

export function listAIKnowledgeBases(): Promise<{ list: AIKnowledgeBase[] }> {
  return request.get('/ai/knowledge-bases');
}

export function createAIKnowledgeBase(data: {
  name: string;
  description?: string;
}): Promise<AIKnowledgeBase> {
  return request.post('/ai/knowledge-bases', data);
}

export function listAIKnowledgeDocuments(
  knowledgeBaseId: string,
): Promise<{ list: AIKnowledgeDocument[] }> {
  return request.get(`/ai/knowledge-bases/${knowledgeBaseId}/documents`);
}

export function uploadAIKnowledgeDocument(
  knowledgeBaseId: string,
  formData: FormData,
): Promise<{ document: AIKnowledgeDocument }> {
  return request.post(`/ai/knowledge-bases/${knowledgeBaseId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function retryAIKnowledgeDocument(
  knowledgeBaseId: string,
  documentId: string,
): Promise<{ document: AIKnowledgeDocument }> {
  return request.post(`/ai/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/retry`);
}

export function deleteAIKnowledgeDocument(
  knowledgeBaseId: string,
  documentId: string,
): Promise<void> {
  return request.delete(`/ai/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`);
}

export function listAIAppKnowledgeBases(appId: string): Promise<{ list: AIKnowledgeBase[] }> {
  return request.get(`/ai/apps/${appId}/knowledge-bases`);
}

export function replaceAIAppKnowledgeBases(
  appId: string,
  knowledgeBaseIds: string[],
): Promise<{ knowledgeBaseIds: string[] }> {
  return request.put(`/ai/apps/${appId}/knowledge-bases`, { knowledgeBaseIds });
}
